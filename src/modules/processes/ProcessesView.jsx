import { ClipboardList, FilePlus2, Pencil, Search, Trash2 } from "lucide-react";

export default function ProcessesView({
  accessLevel,
  processes,
  processForm,
  setProcessForm,
  editingProcessId,
  handleCreateProcess,
  handleEditProcess,
  handleDeleteProcess,
  resetProcessForm,
}) {
  return (
    <section className="process-page">
      <style>{processCss}</style>

      <div className="process-bg-pattern" />

      <header className="process-header">
        <div>
          <div className="process-kicker">DATOS MAESTROS</div>
          <h2>Administración de procesos</h2>
          <p>Solo se muestran procesos del nivel {accessLevel}.</p>
        </div>
      </header>

      <div className="process-grid">
        <article className="process-panel create-panel">
          <div className="panel-title-row">
            <div className="panel-icon">
              <FilePlus2 size={23} />
            </div>

            <div>
              <h3>{editingProcessId ? "Editar proceso" : "Crear proceso"}</h3>
              <p>
                {editingProcessId
                  ? "Actualiza la información del proceso seleccionado."
                  : `Registra un nuevo proceso de nivel ${accessLevel}.`}
              </p>
            </div>
          </div>

          <div className="panel-divider" />

          <form onSubmit={handleCreateProcess} className="process-form">
            <div className="process-field">
              <label>Nombre</label>
              <input
                value={processForm.name}
                onChange={(e) =>
                  setProcessForm({ ...processForm, name: e.target.value })
                }
                placeholder="Ej. Seguridad"
                required
              />
            </div>

            <div className="process-field">
              <label>Nivel</label>
              <input value={`Nivel ${accessLevel}`} disabled />
            </div>

            <div className="process-actions">
              <button className="process-primary" type="submit">
                <span>
                  <FilePlus2 size={18} />
                </span>
                {editingProcessId ? "Actualizar proceso" : "Crear proceso"}
              </button>

              {editingProcessId && (
                <button
                  type="button"
                  className="process-secondary"
                  onClick={resetProcessForm}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </article>

        <article className="process-panel list-panel">
          <div className="list-panel-head">
            <div className="panel-title-row compact">
              <div className="panel-icon">
                <ClipboardList size={23} />
              </div>

              <div>
                <h3>Listado de procesos</h3>
                <p>Consulta y administra los procesos existentes.</p>
              </div>
            </div>

            <div className="process-search">
              <Search size={18} />
              <input placeholder="Buscar proceso..." />
            </div>
          </div>

          <div className="process-table-wrap">
            <table className="process-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Proceso</th>
                  <th>Nivel</th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {processes.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>

                    <td>
                      <strong className="process-name">{item.name}</strong>
                    </td>

                    <td>
                      <span className="level-badge">{item.level}</span>
                    </td>

                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="table-btn edit"
                          onClick={() => handleEditProcess(item)}
                        >
                          <Pencil size={16} />
                          Editar
                        </button>

                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteProcess(item)}
                        >
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!processes.length && (
                  <tr>
                    <td colSpan="4" className="empty">
                      Sin procesos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="process-table-footer">
            <span>
              Mostrando {processes.length} de {processes.length} procesos
            </span>

            <div className="pagination">
              <button type="button">‹</button>
              <button type="button" className="active">
                1
              </button>
              <button type="button">›</button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}

const processCss = `
.process-page {
  position: relative;
  min-height: 100%;
  overflow: hidden;
  padding: clamp(26px, 3vw, 46px);
  color: #0f172a;
  background:
    radial-gradient(circle at 92% 6%, rgba(34,197,94,.09), transparent 30%),
    linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,251,255,.94));
}

.process-bg-pattern {
  position: absolute;
  top: -180px;
  right: -110px;
  width: 640px;
  height: 640px;
  pointer-events: none;
  opacity: .52;
  background:
    radial-gradient(circle at 60% 42%, rgba(34,197,94,.12) 0 2px, transparent 3px),
    radial-gradient(circle at 74% 22%, rgba(34,197,94,.16) 0 3px, transparent 4px),
    radial-gradient(circle at 52% 72%, rgba(34,197,94,.10) 0 5px, transparent 6px),
    repeating-radial-gradient(circle at 78% 58%, transparent 0 46px, rgba(34,197,94,.13) 47px, transparent 48px);
  mask-image: radial-gradient(circle, black, transparent 72%);
}

.process-header {
  position: relative;
  z-index: 1;
  margin-bottom: clamp(26px, 3vw, 44px);
}

.process-kicker {
  color: #059669;
  font-size: 13px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.process-header h2 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(34px, 3vw, 52px);
  line-height: 1.02;
  letter-spacing: -.055em;
  font-weight: 950;
}

.process-header p {
  margin: 14px 0 0;
  color: #64748b;
  font-size: clamp(15px, 1vw, 18px);
  line-height: 1.5;
}

.process-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(340px, 420px) minmax(0, 1fr);
  gap: clamp(20px, 2vw, 28px);
  align-items: stretch;
}

.process-panel {
  border-radius: 22px;
  border: 1px solid rgba(226,232,240,.95);
  background:
    linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.88));
  box-shadow:
    0 20px 54px rgba(15,23,42,.08),
    inset 0 1px 0 rgba(255,255,255,.92);
}

.create-panel {
  min-height: 570px;
  padding: 28px;
}

.list-panel {
  min-height: 570px;
  padding: 28px 28px 22px;
  display: flex;
  flex-direction: column;
}

.panel-title-row {
  display: flex;
  align-items: center;
  gap: 18px;
}

.panel-title-row.compact {
  min-width: 280px;
}

.panel-icon {
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #059669;
  background:
    radial-gradient(circle at 30% 20%, rgba(34,197,94,.22), transparent 52%),
    rgba(34,197,94,.10);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.75);
}

.panel-title-row h3 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
  line-height: 1.15;
  font-weight: 950;
  letter-spacing: -.025em;
}

.panel-title-row p {
  margin: 8px 0 0;
  color: #8190a6;
  font-size: 13px;
  line-height: 1.35;
}

.panel-divider {
  height: 1px;
  width: 100%;
  margin: 24px 0 28px;
  background: linear-gradient(90deg, rgba(148,163,184,.30), transparent);
}

.process-form {
  display: grid;
  gap: 24px;
}

.process-field {
  display: grid;
  gap: 10px;
}

.process-field label {
  color: #1f2937;
  font-size: 13px;
  font-weight: 800;
}

.process-field input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  background: rgba(255,255,255,.92);
  color: #0f172a;
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}

.process-field input::placeholder {
  color: #94a3b8;
}

.process-field input:focus {
  border-color: rgba(34,197,94,.62);
  box-shadow: 0 0 0 4px rgba(34,197,94,.13);
  background: #fff;
}

.process-field input:disabled {
  color: #8da0b8;
  background: #f1f5f9;
  cursor: not-allowed;
}

.process-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.process-primary,
.process-secondary,
.table-btn,
.pagination button {
  border: 0;
  cursor: pointer;
  font-weight: 900;
  transition:
    transform .18s ease,
    box-shadow .18s ease,
    border-color .18s ease,
    background .18s ease;
}

.process-primary:hover,
.process-secondary:hover,
.table-btn:hover,
.pagination button:hover {
  transform: translateY(-1px);
}

.process-primary {
  height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 0 22px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #059669, #22c55e);
  box-shadow: 0 14px 30px rgba(34,197,94,.28);
}

.process-primary span {
  display: grid;
  place-items: center;
}

.process-secondary {
  height: 46px;
  padding: 0 18px;
  border-radius: 12px;
  color: #334155;
  border: 1px solid #dbe4ef;
  background: #fff;
}

.list-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
  margin-bottom: 26px;
}

.process-search {
  width: min(320px, 40%);
  height: 46px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 15px;
  border-radius: 12px;
  border: 1px solid #dbe4ef;
  background: rgba(255,255,255,.92);
  color: #64748b;
}

.process-search input {
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  outline: 0;
  color: #0f172a;
}

.process-search input::placeholder {
  color: #94a3b8;
}

.process-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: rgba(255,255,255,.72);
}

.process-table {
  width: 100%;
  border-collapse: collapse;
}

.process-table th {
  height: 58px;
  padding: 0 22px;
  text-align: left;
  color: #059669;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .055em;
  font-weight: 950;
  background: rgba(248,250,252,.92);
  border-bottom: 1px solid #e2e8f0;
}

.process-table td {
  height: 58px;
  padding: 0 22px;
  color: #1f2937;
  font-size: 14px;
  border-bottom: 1px solid #e5eaf1;
}

.process-table tbody tr {
  transition: background .18s ease;
}

.process-table tbody tr:hover {
  background: rgba(34,197,94,.035);
}

.process-table tbody tr:last-child td {
  border-bottom: 0;
}

.process-name {
  color: #1e293b;
  font-weight: 800;
}

.level-badge {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  border-radius: 9px;
  color: #059669;
  background: rgba(34,197,94,.11);
  font-weight: 950;
}

.actions-col {
  width: 230px;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: #fff;
  font-size: 13px;
}

.table-btn.edit {
  color: #059669;
  border-color: rgba(5,150,105,.18);
}

.table-btn.edit:hover {
  background: rgba(34,197,94,.08);
  box-shadow: 0 8px 18px rgba(34,197,94,.12);
}

.table-btn.delete {
  color: #ef4444;
  border-color: rgba(239,68,68,.16);
}

.table-btn.delete:hover {
  background: rgba(239,68,68,.06);
  box-shadow: 0 8px 18px rgba(239,68,68,.09);
}

.empty {
  height: 140px !important;
  text-align: center;
  color: #94a3b8 !important;
  font-weight: 800;
}

.process-table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 2px 0;
  color: #8190a6;
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 9px;
}

.pagination button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid #dbe4ef;
  background: #fff;
  color: #64748b;
}

.pagination button.active {
  color: #059669;
  border-color: rgba(34,197,94,.42);
  background: rgba(34,197,94,.08);
}

@media (max-width: 1180px) {
  .process-page {
    padding: 24px;
  }

  .process-grid {
    grid-template-columns: 1fr;
  }

  .create-panel,
  .list-panel {
    min-height: auto;
  }

  .list-panel-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .process-search {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .process-page {
    padding: 18px;
  }

  .process-header h2 {
    font-size: 32px;
  }

  .create-panel,
  .list-panel {
    padding: 20px;
    border-radius: 18px;
  }

  .process-table-wrap {
    overflow-x: auto;
  }

  .process-table {
    min-width: 720px;
  }

  .process-table-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
`;