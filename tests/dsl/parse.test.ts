import { describe, it, expect } from 'vitest';
import { parseDiagram } from '../../src/dsl/parse';

describe('DSL Parser', () => {
  it('parses empty string', () => {
    const result = parseDiagram('');
    expect(result.spec.nodes).toEqual([]);
    expect(result.spec.edges).toEqual([]);
    expect(result.issues).toEqual([]);
  });

  it('ignores comments and empty lines', () => {
    const result = parseDiagram(`
      # This is a comment
      // This is also a comment
      
    `);
    expect(result.spec.nodes).toEqual([]);
  });

  it('parses a node with a label', () => {
    const result = parseDiagram('api: API Gateway');
    expect(result.spec.nodes).toEqual([
      { key: 'api', label: 'API Gateway', shape: 'rectangle' }
    ]);
  });

  it('parses a node with a shape modifier', () => {
    const result = parseDiagram('db: Postgres [ellipse]');
    expect(result.spec.nodes).toEqual([
      { key: 'db', label: 'Postgres', shape: 'ellipse' }
    ]);
  });

  it('parses a node with a shape and color modifier', () => {
    const result = parseDiagram('cache: Redis [diamond] {blue}');
    expect(result.spec.nodes).toEqual([
      { key: 'cache', label: 'Redis', shape: 'diamond', fill: 'blue' }
    ]);
  });

  it('parses a node with a color modifier first', () => {
    const result = parseDiagram('cache: Redis {red} [diamond]');
    expect(result.spec.nodes).toEqual([
      { key: 'cache', label: 'Redis', shape: 'diamond', fill: 'red' }
    ]);
  });

  it('parses an edge and implicitly creates nodes', () => {
    const result = parseDiagram('a -> b');
    expect(result.spec.nodes).toEqual([
      { key: 'a', label: 'a', shape: 'rectangle' },
      { key: 'b', label: 'b', shape: 'rectangle' }
    ]);
    expect(result.spec.edges).toEqual([
      { from: 'a', to: 'b', kind: 'arrow', label: undefined, route: undefined }
    ]);
  });

  it('parses an edge with a label', () => {
    const result = parseDiagram('a -> b: calls');
    expect(result.spec.edges).toEqual([
      { from: 'a', to: 'b', kind: 'arrow', label: 'calls', route: undefined }
    ]);
  });

  it('parses an edge with a route modifier', () => {
    const result = parseDiagram('a -> b: calls (straight)');
    expect(result.spec.edges).toEqual([
      { from: 'a', to: 'b', kind: 'arrow', label: 'calls', route: 'straight' }
    ]);
  });

  it('parses dashed arrows and lines', () => {
    const result = parseDiagram(`
      a --> b
      b -- c
    `);
    expect(result.spec.edges).toEqual([
      { from: 'a', to: 'b', kind: 'dashed', label: undefined, route: undefined },
      { from: 'b', to: 'c', kind: 'line', label: undefined, route: undefined },
    ]);
  });

  it('reports an issue for an invalid node name in declaration', () => {
    const result = parseDiagram('invalid name!: Label');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('not a valid name');
  });

  it('reports an issue for an invalid node name in edge', () => {
    const result = parseDiagram('invalid! -> b');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('not a valid name');
  });

  it('reports an issue for unknown shape in declaration', () => {
    const result = parseDiagram('a: Label [triangle]');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('Unknown shape "triangle"');
  });

  it('reports an issue for unknown shape in edge label', () => {
    const result = parseDiagram('a -> b: Label [triangle]');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('not a known shape');
  });

  it('reports an issue for duplicate edges', () => {
    const result = parseDiagram(`
      a -> b
      a -> b: again
    `);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('already connected');
  });

  it('allows bare words as node declaration', () => {
    const result = parseDiagram('db [ellipse]');
    expect(result.spec.nodes).toEqual([
      { key: 'db', label: 'db', shape: 'ellipse' }
    ]);
  });

  it('allows bare words with color', () => {
    const result = parseDiagram('db {green}');
    expect(result.spec.nodes).toEqual([
      { key: 'db', label: 'db', shape: 'rectangle', fill: 'green' }
    ]);
  });

  it('updates an implicitly created node if declared later', () => {
    const result = parseDiagram(`
      a -> b
      a: A Label
    `);
    expect(result.spec.nodes).toEqual([
      { key: 'a', label: 'A Label', shape: 'rectangle' },
      { key: 'b', label: 'b', shape: 'rectangle' }
    ]);
  });
});
