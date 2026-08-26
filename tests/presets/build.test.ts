import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../../src/store';
import { glyphPreview,  serviceDefinition, placeService } from '../../src/presets/build';
import type { Glyph, ServicePreset } from '../../src/presets/catalog';

describe('Presets Build', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  describe('glyphPreview', () => {
    it('generates all glyph types without crashing', () => {
      const glyphs: Glyph[] = [
        "compute", "function", "container", "storage", "database", 
        "network", "cdn", "queue", "analytics", "security", "ai"
      ];
      
      for (const glyph of glyphs) {
        const preview = glyphPreview(glyph, 'red');
        expect(preview.elements.length).toBeGreaterThan(0);
        expect(preview.size).toBe(30);
      }
    });
  });

  describe('serviceDefinition', () => {
    it('creates a component definition from a preset', () => {
      const preset: ServicePreset = {
        id: 'aws-lambda',
        name: 'AWS Lambda',
        provider: 'aws',
        glyph: 'function',
        category: 'Compute'
      };
      
      const def = serviceDefinition(preset);
      expect(def.id).toBe('aws-lambda');
      expect(def.name).toBe('AWS Lambda');
      expect(def.elements.length).toBeGreaterThan(0);
      expect(def.elements[0].type).toBe('rectangle'); // The outer bounds
    });
  });

  describe('placeService', () => {
    it('registers definition and adds instance to scene', () => {
      const preset: ServicePreset = {
        id: 'aws-s3',
        name: 'Amazon S3',
        provider: 'aws',
        glyph: 'storage',
        category: 'Storage'
      };
      
      placeService(preset, 100, 100);
      
      expect(store.components['aws-s3']).toBeDefined();
      expect(store.visibleElements.length).toBe(1);
      
      const instance = store.visibleElements[0];
      expect(instance.type).toBe('instance');
      expect(instance.x).toBe(100);
      expect(instance.y).toBe(100);
      expect(store.appState.selectedIds).toEqual([instance.id]);
    });

    it('finds free spot if placed on top of existing elements', () => {
      const preset1: ServicePreset = {
        id: 'aws-s3',
        name: 'Amazon S3',
        provider: 'aws',
        glyph: 'storage',
        category: 'Storage'
      };
      
      const preset2: ServicePreset = {
        id: 'aws-ec2',
        name: 'Amazon EC2',
        provider: 'aws',
        glyph: 'compute',
        category: 'Compute'
      };
      
      // Place first service
      placeService(preset1, 100, 100);
      
      // Place second service at exact same coordinates
      placeService(preset2, 100, 100);
      
      expect(store.visibleElements.length).toBe(2);
      
      const instance1 = store.visibleElements[0];
      const instance2 = store.visibleElements[1];
      
      expect(instance1.x).toBe(100);
      expect(instance1.y).toBe(100);
      
      // instance2 should have moved over
      expect(instance2.x).toBeGreaterThan(100);
      expect(instance2.y).toBeGreaterThan(100);
    });
  });
});
