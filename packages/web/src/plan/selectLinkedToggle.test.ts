import { describe, expect, it, beforeEach } from 'vitest';
import { useBimStore } from '../state/store';

beforeEach(() => {
  useBimStore.setState({ selectLinkedEnabled: false });
});

describe('Select linked toggle — §3.3.1', () => {
  it('selectLinkedEnabled defaults to false', () => {
    expect(useBimStore.getState().selectLinkedEnabled).toBe(false);
  });

  it('setSelectLinkedEnabled toggles the value', () => {
    useBimStore.getState().setSelectLinkedEnabled(true);
    expect(useBimStore.getState().selectLinkedEnabled).toBe(true);
    useBimStore.getState().setSelectLinkedEnabled(false);
    expect(useBimStore.getState().selectLinkedEnabled).toBe(false);
  });
});
