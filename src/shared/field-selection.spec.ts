import { parseFieldSelection, pickFields } from './field-selection';

describe('parseFieldSelection', () => {
  it('유효한 필드 문자열 파싱', () => {
    expect(parseFieldSelection('id,name,email', ',')).toEqual(['id', 'name', 'email']);
  });

  it('공백 트림', () => {
    expect(parseFieldSelection('id , name , email', ',')).toEqual(['id', 'name', 'email']);
  });

  it('빈 문자열 → undefined', () => {
    expect(parseFieldSelection('', ',')).toBeUndefined();
  });

  it('undefined → undefined', () => {
    expect(parseFieldSelection(undefined, ',')).toBeUndefined();
  });

  it('배열 입력 시 첫 번째 요소 사용', () => {
    expect(parseFieldSelection(['id,name', 'other'] as unknown as string, ',')).toEqual(['id', 'name']);
  });

  it('커스텀 separator', () => {
    expect(parseFieldSelection('id;name;email', ';')).toEqual(['id', 'name', 'email']);
  });

  it('빈 요소 필터링', () => {
    expect(parseFieldSelection('id,,name,', ',')).toEqual(['id', 'name']);
  });
});

describe('pickFields', () => {
  const data = {
    id: 1,
    name: 'John',
    email: 'john@example.com',
    age: 30,
    address: {
      city: 'Seoul',
      zip: '12345',
      country: 'KR',
    },
  };

  it('최상위 필드만 선택', () => {
    expect(pickFields(data, ['id', 'name'], 3)).toEqual({ id: 1, name: 'John' });
  });

  it('모든 필드 선택 시 동일 결과', () => {
    expect(pickFields(data, ['id', 'name', 'email', 'age', 'address'], 3)).toEqual(data);
  });

  it('존재하지 않는 필드 무시', () => {
    expect(pickFields(data, ['id', 'nonexistent'], 3)).toEqual({ id: 1 });
  });

  it('중첩 필드 (dot-notation)', () => {
    expect(pickFields(data, ['id', 'address.city'], 3)).toEqual({
      id: 1,
      address: { city: 'Seoul' },
    });
  });

  it('여러 중첩 필드 동일 부모', () => {
    expect(pickFields(data, ['address.city', 'address.zip'], 3)).toEqual({
      address: { city: 'Seoul', zip: '12345' },
    });
  });

  it('배열 데이터에 적용', () => {
    const items = [
      { id: 1, name: 'A', secret: 'x' },
      { id: 2, name: 'B', secret: 'y' },
    ];
    expect(pickFields(items, ['id', 'name'], 3)).toEqual([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ]);
  });

  it('null 반환', () => {
    expect(pickFields(null, ['id'], 3)).toBeNull();
  });

  it('undefined 반환', () => {
    expect(pickFields(undefined, ['id'], 3)).toBeUndefined();
  });

  it('프리미티브 값 그대로 반환', () => {
    expect(pickFields('string', ['id'], 3)).toBe('string');
    expect(pickFields(42, ['id'], 3)).toBe(42);
  });

  it('maxDepth 초과 시 해당 필드 무시', () => {
    const deep = { a: { b: { c: { d: 'deep' } } } };
    expect(pickFields(deep, ['a.b.c.d'], 2)).toEqual({});
    expect(pickFields(deep, ['a.b.c.d'], 4)).toEqual({ a: { b: { c: { d: 'deep' } } } });
  });

  it('중첩 경로 중간이 없는 경우 무시', () => {
    expect(pickFields(data, ['nonexistent.child'], 3)).toEqual({});
  });

  it('빈 필드 배열', () => {
    expect(pickFields(data, [], 3)).toEqual({});
  });
});
