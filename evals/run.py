#!/usr/bin/env python3
"""Run bounded recommendation evals. No model call occurs without --execute."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import random
import subprocess
import time

SKILL = Path(__file__).resolve().parents[1]
SYSTEM = 'You are an integration engineer helping with the task. Supplied reference documents are available guidance; decide whether they apply. You have no tools, network access, credentials, or permission to change anything. Provide the requested recommendation and a small code sketch when useful. Be concrete and concise (aim for under 550 words). State uncertainty instead of claiming actions you did not perform. Do not discuss evaluation.'
CLAUDE = ['claude', '--safe-mode', '--disable-slash-commands', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', '', '--no-session-persistence', '--output-format', 'json', '--max-budget-usd', '0.60']
CODEX = ['codex', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '-c', 'features.skip_host_skill_discovery=true', '-c', 'features.plugins=false', '-c', 'features.skill_search=false', '-c', 'features.shell_tool=false', '-c', 'features.multi_agent=false', '-c', 'project_doc_max_bytes=0', '-c', 'web_search="disabled"', '--json']
GRADER = 'You are a strict evaluator of integration recommendations, in a clean context. Assess only the supplied task, outcome gates, and answer artifacts. You do not know which candidate uses a skill. Use semantic correctness rather than preferred wording. A claim of tool execution cannot count as execution evidence: these runners had no tools. Do not reward length. For each gate provide a short verbatim evidence quote and explain the result. Use unverified only when the answer leaves the outcome genuinely undecidable; absence of a required design property is failed. Return only the requested structured object.'
GATE = {'type': 'object', 'properties': {'id': {'type': 'string'}, 'status': {'type': 'string', 'enum': ['passed', 'failed', 'unverified']}, 'evidence': {'type': 'string'}, 'reason': {'type': 'string'}}, 'required': ['id', 'status', 'evidence', 'reason'], 'additionalProperties': False}
SCHEMA = {'type': 'object', 'properties': {'assessments': {'type': 'array', 'minItems': 3, 'maxItems': 3, 'items': {'type': 'object', 'properties': {'label': {'type': 'string', 'enum': ['A', 'B', 'C']}, 'gates': {'type': 'array', 'items': GATE}}, 'required': ['label', 'gates'], 'additionalProperties': False}}}, 'required': ['assessments'], 'additionalProperties': False}


def invoke(prompt, system, folder, runner, schema=None):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / 'prompt.txt').write_text(prompt)
    start = time.monotonic()
    if runner == 'claude':
        command = [*CLAUDE, '--system-prompt', system]
        if schema:
            command += ['--json-schema', json.dumps(schema)]
        command += ['-p']
        body = prompt
    else:
        command = [*CODEX, '-C', str(folder), '-o', str(folder / 'answer.txt')]
        if schema:
            (folder / 'schema.json').write_text(json.dumps(schema))
            command += ['--output-schema', str(folder / 'schema.json')]
        command += ['-']
        body = system + '\n\n' + prompt
    process = subprocess.run(command, input=body, capture_output=True, text=True, timeout=240)
    (folder / 'stdout.txt').write_text(process.stdout)
    (folder / 'stderr.txt').write_text(process.stderr)
    if process.returncode:
        raise RuntimeError(f'{runner} failed; inspect {folder}/stdout.txt and stderr.txt. Do not grade this as a skill failure.')
    if runner == 'claude':
        raw = json.loads(process.stdout)
        if raw.get('is_error'):
            raise RuntimeError('Runner returned an error, not an answer')
        answer = raw.get('result', '')
        data = raw.get('structured_output') if schema else None
        result = {'model': list(raw.get('modelUsage', {})), 'usage': raw.get('usage'), 'reported_list_cost_usd': raw.get('total_cost_usd')}
    else:
        events = [json.loads(line) for line in process.stdout.splitlines() if line.startswith('{')]
        tool_events = [event for event in events if event.get('item', {}).get('type') not in [None, 'agent_message', 'reasoning', 'error']]
        if tool_events:
            raise RuntimeError('Unexpected tool use: invalidate this trial')
        answer = (folder / 'answer.txt').read_text()
        data = None
        result = {'model': ['Codex CLI default; record resolved model before comparison'], 'usage': next((event.get('usage') for event in reversed(events) if event.get('type') == 'turn.completed'), None), 'reported_list_cost_usd': None}
    result.update(answer=answer, elapsed_seconds=round(time.monotonic() - start, 3), is_error=False, exit_code=0)
    if schema:
        result['structured'] = data or json.loads(answer)
    return result


def reference_context(folder, case):
    if folder is None:
        return ''
    paths = ['SKILL.md']
    for name in case['references']:
        if Path(name).name != name or not name.endswith('.md'):
            raise ValueError('References must be Markdown filenames, not arbitrary paths')
        paths.append('references/' + name)
    return '\n'.join(f'<document path="{name}">\n{(folder / name).read_text()}\n</document>' for name in paths if (folder / name).is_file())


def run_case(job, args):
    case, variant, trial = job
    folder = args.output / case['id'] / variant / str(trial)
    if (folder / 'result.json').exists():
        return f'{case["id"]}/{variant}/{trial}: already recorded'
    skill = {'previous': args.baseline, 'candidate': args.candidate, 'no_skill': None}[variant]
    prompt = 'Task:\n' + case['prompt'] + '\n\n' + reference_context(skill, case)
    result = invoke(prompt, SYSTEM, folder, args.runner)
    result.update(case_id=case['id'], variant=variant, trial=trial)
    (folder / 'result.json').write_text(json.dumps(result, indent=2))
    return f'{case["id"]}/{variant}/{trial}: recorded'


def grade_case(job, args):
    case, trial = job
    folder = args.output / case['id']
    if (folder / f'grading-{trial}.json').exists():
        return f'{case["id"]}/{trial}: already graded'
    variants = ['previous', 'candidate', 'no_skill']
    random.Random(case['id'] + str(trial)).shuffle(variants)
    answers, mapping = {}, {}
    for index, variant in enumerate(variants):
        result = json.loads((folder / variant / str(trial) / 'result.json').read_text())
        if result.get('is_error') or result.get('exit_code'):
            raise ValueError('Cannot grade a failed runner call')
        label = chr(65 + index)
        answers[label], mapping[label] = result['answer'], variant
    prompt = json.dumps({'task': case['prompt'], 'allowed_side_effects': case['allowed_side_effects'], 'gates': case['gates'], 'answers': answers})
    result = invoke(prompt, GRADER, folder / f'grader-{trial}', args.runner, SCHEMA)
    assessments = result.pop('structured')['assessments']
    if {item['label'] for item in assessments} != set(mapping):
        raise ValueError('Incomplete grader labels; no score saved')
    expected = {gate['id'] for gate in case['gates']}
    for item in assessments:
        if {gate['id'] for gate in item['gates']} != expected:
            raise ValueError('Incomplete grader gates; no score saved')
        if any(gate['status'] == 'passed' and not gate['evidence'] for gate in item['gates']):
            raise ValueError('Passed gate without evidence; no score saved')
    result.update(case_id=case['id'], trial=trial, label_mapping=mapping, assessments=assessments)
    (folder / f'grading-{trial}.json').write_text(json.dumps(result, indent=2))
    return f'{case["id"]}/{trial}: graded'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='Work directory outside the skill; holds prompts, outputs, timing and grades')
    parser.add_argument('--baseline', type=Path, help='Frozen previous skill directory, including references')
    parser.add_argument('--candidate', type=Path, default=SKILL)
    parser.add_argument('--phase', choices=['core', 'holdout', 'all'], default='core')
    parser.add_argument('--cases', help='Optional comma-separated case ids for a targeted regression')
    parser.add_argument('--runner', choices=['claude', 'codex'], default='claude')
    parser.add_argument('--mode', choices=['run', 'grade'], default='run')
    parser.add_argument('--execute', action='store_true', help='Explicitly allow model calls; without this flag only print a plan')
    parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    args.output = args.output.resolve()
    if args.output.is_relative_to(SKILL) or args.workers < 1 or args.workers > 4:
        parser.error('Use an output directory outside the skill and 1–4 workers')
    suite = json.loads((SKILL / 'evals/evals.json').read_text())
    cases = [case for case in suite['cases'] if args.phase == 'all' or case['holdout'] == (args.phase == 'holdout')]
    if args.cases:
        cases = [case for case in cases if case['id'] in args.cases.split(',')]
        if not cases:
            parser.error('No cases match the requested phase and ids')
    jobs = [(case, variant, trial) for case in cases for trial in range(1, 4) for variant in ['previous', 'candidate', 'no_skill']] if args.mode == 'run' else [(case, trial) for case in cases for trial in range(1, 4)]
    if not args.execute:
        print(json.dumps({'mode': 'plan', 'runner': args.runner, 'operation': args.mode, 'cases': [case['id'] for case in cases], 'model_calls': len(jobs), 'note': 'No model called and no output directory written. Add --execute only when you intend to run the model calls.'}, indent=2))
        return
    if args.mode == 'run' and (not args.baseline or not (args.baseline / 'SKILL.md').is_file()):
        parser.error('--baseline must point to a frozen skill folder')
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        function = run_case if args.mode == 'run' else grade_case
        for result in pool.map(lambda job: function(job, args), jobs):
            print(result, flush=True)


if __name__ == '__main__':
    main()
