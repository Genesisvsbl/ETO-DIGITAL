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
    <section className="content-card">
      <div className="card-header-block">
        <div>
          <div className="section-kicker">DATOS MAESTROS</div>
          <h3>Administración de procesos</h3>
          <p>Solo se muestran procesos del nivel {accessLevel}.</p>
        </div>
      </div>

      <div className="split-grid">
        <div className="panel-block">
          <div className="subsection-title">
            {editingProcessId ? "Editar proceso" : "Crear proceso"}
          </div>

          <form onSubmit={handleCreateProcess} className="inline-form-grid two-cols">
            <div className="field">
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

            <div className="field">
              <label>Nivel</label>
              <input value={`Nivel ${accessLevel}`} disabled />
            </div>

            <div className="field full">
              <div className="actions">
                <button className="primary">
                  {editingProcessId ? "Actualizar proceso" : "Crear proceso"}
                </button>

                {editingProcessId && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={resetProcessForm}
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="panel-block">
          <div className="subsection-title">Listado de procesos</div>

          <div className="table-wrap">
            <table>
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
                    <td>{item.name}</td>
                    <td>{item.level}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="table-btn edit"
                          onClick={() => handleEditProcess(item)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="table-btn delete"
                          onClick={() => handleDeleteProcess(item)}
                        >
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
        </div>
      </div>
    </section>
  );
}