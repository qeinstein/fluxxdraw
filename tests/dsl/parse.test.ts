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
    const result = parseDiagram('a: Label [star]');
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain('Unknown shape "star"');
  });

  it('reports an issue for unknown shape in edge label', () => {
    const result = parseDiagram('a -> b: Label [star]');
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

  it('parses rich nodes, edges, frames, text and paths', () => {
    const result = parseDiagram(`
      layout right
      frame clients "Clients" at=40,60 size=300x240 fill=#f8fafc
      node api "API Gateway" shape=rounded at=120,100 size=180x90 fill=#e8f1ff stroke=#2563eb frame=clients
      node db "Postgres" shape=cylinder strokeWidth=2
      edge api -> db "queries" route=orthogonal from=east to=west end=triangle stroke=dashed
      text title "Checkout System" at=120,20 size-text=28 font=normal
      path sketch kind=line points="0,0 20,20 50,5" closed stroke=#ef4444
    `);

    expect(result.issues).toEqual([]);
    expect(result.spec.rich).toBe(true);
    expect(result.spec.layout).toBe('right');
    expect(result.spec.frames?.[0]).toMatchObject({ key: 'clients', label: 'Clients', x: 40, width: 300 });
    expect(result.spec.nodes[0]).toMatchObject({
      key: 'api', label: 'API Gateway', shape: 'rectangle', edges: 'round', x: 120, fill: '#e8f1ff', frame: 'clients'
    });
    expect(result.spec.edges[0]).toMatchObject({
      route: 'elbow', startPort: 'east', endPort: 'west', endArrowhead: 'triangle', strokeStyle: 'dashed'
    });
    expect(result.spec.texts?.[0]).toMatchObject({ text: 'Checkout System', fontSize: 28, fontFamily: 'normal' });
    expect(result.spec.paths?.[0]).toMatchObject({ kind: 'line', closed: true, points: [[0, 0], [20, 20], [50, 5]] });
  });
});
