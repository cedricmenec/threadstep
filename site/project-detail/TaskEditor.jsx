import { useState } from "react";
import { NOTE_MAX_LENGTH } from "../core.js";

const MAX_TITLE = 300;

export function TaskEditor({ subjectId, item, commands }) {
  const [title, setTitle] = useState(item.title);
  const [priority, setPriority] = useState(item.priority);
  const [note, setNote] = useState(typeof item.note === "string" ? item.note : "");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (note.length > NOTE_MAX_LENGTH) {
      setError("La note doit contenir au plus 2000 caractères.");
      return;
    }
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TITLE) {
      setError("Le titre doit contenir entre 1 et 300 caractères.");
      return;
    }
    setError("");
    commands.updateItem(subjectId, item.id, {
      title,
      priority,
      note
    });
  }

  return (
    <form className="task-edit-form" onSubmit={submit}>
      <input
        className="task-edit-title"
        type="text"
        maxLength={MAX_TITLE}
        required
        value={title}
        aria-label={"Titre de l'étape " + item.title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <select
        className="task-edit-priority"
        aria-label={"Priorité de l'étape " + item.title}
        value={priority}
        onChange={(event) => setPriority(event.target.value)}
      >
        <option value="urgent">Urgent</option>
        <option value="normal">Normal</option>
        <option value="later">Plus tard</option>
      </select>
      <label className="task-edit-note-label">
        Note (facultative)
        <textarea
          className="task-edit-note"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          aria-label={"Note (facultative) de l'étape " + item.title}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button className="primary" type="submit">Enregistrer</button>
      <button
        className="subtle"
        type="button"
        onClick={() => commands.cancelEdit(subjectId, item.id)}
      >
        Annuler
      </button>
      {error ? <p className="edit-error" role="alert">{error}</p> : null}
    </form>
  );
}

export default TaskEditor;
