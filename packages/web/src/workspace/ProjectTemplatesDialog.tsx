import { useState } from 'react';
import { useBimStore } from '../state/store';

export function ProjectTemplatesDialog({ onClose }: { onClose: () => void }) {
  const templates = useBimStore((s) => s.projectTemplates);
  const saveProjectAsTemplate = useBimStore((s) => s.saveProjectAsTemplate);
  const loadProjectTemplate = useBimStore((s) => s.loadProjectTemplate);
  const deleteProjectTemplate = useBimStore((s) => s.deleteProjectTemplate);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div
      data-testid="project-templates-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: '#1a1a2e',
          color: '#eee',
          padding: 24,
          borderRadius: 8,
          width: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Project Templates</h3>

        {/* Save current project as template */}
        <fieldset
          style={{ marginBottom: 16, border: '1px solid #444', borderRadius: 4, padding: 12 }}
        >
          <legend>Save Current Project as Template</legend>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Name
            <input
              data-testid="template-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            Description
            <input
              data-testid="template-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '4px 8px' }}
            />
          </label>
          <button
            data-testid="template-save-btn"
            disabled={!name.trim()}
            onClick={() => {
              saveProjectAsTemplate(name.trim(), description.trim());
              setName('');
              setDescription('');
            }}
          >
            Save Template
          </button>
        </fieldset>

        {/* List of saved templates */}
        <h4 style={{ marginBottom: 8 }}>Saved Templates ({templates.length})</h4>
        {templates.length === 0 && (
          <p data-testid="template-empty-state" style={{ color: '#888', fontSize: 13 }}>
            No templates saved yet.
          </p>
        )}
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            data-testid={`template-row-${tpl.id}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid #333',
            }}
          >
            <div>
              <strong data-testid={`template-name-${tpl.id}`}>{tpl.name}</strong>
              {tpl.description && (
                <div style={{ fontSize: 12, color: '#aaa' }}>{tpl.description}</div>
              )}
              <div style={{ fontSize: 11, color: '#666' }}>
                {new Date(tpl.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                data-testid={`template-load-${tpl.id}`}
                onClick={() => {
                  loadProjectTemplate(tpl.id);
                  onClose();
                }}
              >
                Load
              </button>
              <button
                data-testid={`template-delete-${tpl.id}`}
                onClick={() => deleteProjectTemplate(tpl.id)}
                style={{ color: '#f87171' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        <button
          data-testid="project-templates-close"
          onClick={onClose}
          style={{ marginTop: 16, display: 'block', marginLeft: 'auto' }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
