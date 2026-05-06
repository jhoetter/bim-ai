import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, SelectionSetRule } from '@bim-ai/core';

function matchesRule(e: Element, rule: SelectionSetRule): boolean {
  if (rule.field === 'category') {
    return rule.operator === 'equals' ? e.kind === rule.value : e.kind.includes(rule.value);
  }
  if (rule.field === 'level') {
    if (!('levelId' in e)) return false;
    const lvl = (e as unknown as { levelId: unknown }).levelId;
    return rule.operator === 'equals' ? lvl === rule.value : String(lvl).includes(rule.value);
  }
  if (rule.field === 'typeName') {
    if (!('name' in e)) return false;
    const nm = (e as unknown as { name: unknown }).name;
    return rule.operator === 'equals' ? nm === rule.value : String(nm).includes(rule.value);
  }
  return false;
}

export function SelectionSetPanel({
  el,
  elements,
}: {
  el: Extract<Element, { kind: 'selection_set' }>;
  elements: Record<string, Element>;
}): JSX.Element {
  const { t } = useTranslation();
  const [rules, setRules] = useState<SelectionSetRule[]>(el.filterRules);

  const matchCount = Object.values(elements).filter((e) =>
    rules.every((rule) => matchesRule(e, rule)),
  ).length;

  function updateRule(index: number, patch: Partial<SelectionSetRule>): void {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRule(index: number): void {
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  function addRule(): void {
    setRules((prev) => [...prev, { field: 'category', operator: 'equals', value: '' }]);
  }

  return (
    <div className="flex flex-col gap-2 text-[11px]">
      {rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-1">
          <select
            aria-label={t('coordination.ruleField')}
            className="rounded border border-border bg-background px-1 py-0.5 text-[11px]"
            value={rule.field}
            onChange={(e) => updateRule(i, { field: e.target.value as SelectionSetRule['field'] })}
          >
            <option value="category">category</option>
            <option value="level">level</option>
            <option value="typeName">typeName</option>
          </select>
          <select
            aria-label={t('coordination.ruleOperator')}
            className="rounded border border-border bg-background px-1 py-0.5 text-[11px]"
            value={rule.operator}
            onChange={(e) =>
              updateRule(i, { operator: e.target.value as SelectionSetRule['operator'] })
            }
          >
            <option value="equals">equals</option>
            <option value="contains">contains</option>
          </select>
          <input
            type="text"
            aria-label={t('coordination.ruleValue')}
            className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-[11px]"
            value={rule.value}
            onChange={(e) => updateRule(i, { value: e.target.value })}
          />
          <button
            type="button"
            aria-label="remove-rule"
            onClick={() => removeRule(i)}
            className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="self-start rounded border border-border bg-background px-2 py-0.5 text-[11px] hover:bg-surface-strong"
      >
        {t('coordination.addRule')}
      </button>
      <div className="text-[11px] text-muted">
        {t('coordination.matchedElements')}: {matchCount}
      </div>
    </div>
  );
}
