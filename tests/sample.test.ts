import { describe, it, expect } from 'vitest';

describe('Sample test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2);
  });

  it('can access the DOM', () => {
    const div = document.createElement('div');
    div.id = 'test-id';
    document.body.appendChild(div);
    expect(document.getElementById('test-id')).not.toBeNull();
  });
});
