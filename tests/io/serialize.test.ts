import { describe, it, expect } from 'vitest';
import { serializeScene, parseSceneDocument, sceneToJson, collectUsedFiles } from '../../src/io/serialize';
import { DOCUMENT_TYPE, FILE_SOURCE, FILE_VERSION } from '../../src/types';
import type { ExcaliElement, BinaryFile, AppState } from '../../src/types';

describe('Serialize', () => {
  describe('collectUsedFiles', () => {
    it('returns only files used by image elements', () => {
      const elements: ExcaliElement[] = [
        { type: 'rectangle', id: '1' } as unknown as ExcaliElement,
        { type: 'image', id: '2', fileId: 'file-1' } as unknown as ExcaliElement
      ];
      const files: Record<string, BinaryFile> = {
        'file-1': { id: "1", mimeType: 'image/png', dataURL: 'data:image/png;base64,...', created: 1 },
        'file-2': { id: "1", mimeType: 'image/png', dataURL: 'data:image/png;base64,...', created: 2 },
      };
      
      const used = collectUsedFiles(elements, files);
      expect(Object.keys(used)).toEqual(['file-1']);
    });
  });

  describe('serializeScene', () => {
    it('serializes scene excluding deleted elements', () => {
      const elements: ExcaliElement[] = [
        { type: 'rectangle', id: '1', isDeleted: false } as unknown as ExcaliElement,
        { type: 'ellipse', id: '2', isDeleted: true } as unknown as ExcaliElement
      ];
      const appState = { viewBackgroundColor: '#ffffff', gridSize: null, theme: 'light' } as AppState;
      
      const doc = serializeScene(elements, {}, appState);
      
      expect(doc.type).toBe(DOCUMENT_TYPE);
      expect(doc.version).toBe(FILE_VERSION);
      expect(doc.source).toBe(FILE_SOURCE);
      expect(doc.elements.length).toBe(1);
      expect(doc.elements[0].id).toBe('1');
    });
  });

  describe('sceneToJson', () => {
    it('converts to JSON string', () => {
      const doc: any = { type: DOCUMENT_TYPE, version: 2, source: 'test', elements: [], files: {}, appState: { viewBackgroundColor: '#fff', gridSize: null, theme: 'light' as const } };
      const json = sceneToJson(doc);
      expect(typeof json).toBe('string');
      expect(JSON.parse(json)).toEqual(doc);
    });
  });

  describe('parseSceneDocument', () => {
    it('throws if not an object', () => {
      expect(() => parseSceneDocument(null)).toThrow('expected an object');
      expect(() => parseSceneDocument('string')).toThrow('expected an object');
    });

    it('throws if type is invalid', () => {
      expect(() => parseSceneDocument({ type: 'invalid', elements: [] })).toThrow('unexpected type');
    });

    it('throws if elements is missing', () => {
      expect(() => parseSceneDocument({ type: DOCUMENT_TYPE })).toThrow('missing an elements array');
    });

    it('parses valid minimal scene and injects defaults', () => {
      const doc = parseSceneDocument({ type: DOCUMENT_TYPE, elements: [{ id: '1', type: 'rectangle' }] });
      expect(doc.elements[0].groupIds).toEqual([]);
      expect(doc.elements[0].isDeleted).toBe(false);
      expect(doc.appState.theme).toBe('light'); // default
    });

    it('migrates older boolean elbowed to pathType elbow', () => {
      const doc = parseSceneDocument({ 
        type: DOCUMENT_TYPE, 
        elements: [{ id: '1', type: 'arrow', elbowed: true }] 
      });
      const arrow = doc.elements[0] as any;
      expect(arrow.pathType).toBe('elbow');
      expect(arrow.elbowed).toBeUndefined();
    });
    
    it('migrates older non-elbowed arrow to pathType straight', () => {
      const doc = parseSceneDocument({ 
        type: DOCUMENT_TYPE, 
        elements: [{ id: '1', type: 'arrow' }] 
      });
      const arrow = doc.elements[0] as any;
      expect(arrow.pathType).toBe('straight');
    });

    it('removes stale bindings to missing elements', () => {
      const doc = parseSceneDocument({
        type: DOCUMENT_TYPE,
        elements: [
          { 
            id: '1', 
            type: 'fluxxdraw' as any, 
            startBinding: { elementId: 'missing' },
            endBinding: { elementId: 'exists' }
          },
          {
            id: 'exists',
            type: 'rectangle'
          }
        ]
      });
      
      const arrow = doc.elements[0] as any;
      expect(arrow.startBinding).toBeNull();
      expect(arrow.endBinding).toEqual({ elementId: 'exists' });
    });
  });
});
