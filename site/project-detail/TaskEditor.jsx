import { useState } from "react";
import { NOTE_MAX_LENGTH } from "../core.js";
import { Button } from "../ui/Button.jsx";
import { PriorityControl } from "../ui/PriorityControl.jsx";
import { TextField } from "../ui/TextField.jsx";

const MAX_TITLE = 300;

export function TaskEditor({ subjectId, item, commands }) {
  const [title, setTitle] = useState(item.title);
  const [priority, setPriority] = useState(item.priority);
  const [note, setNote] = useState(typeof item.note === "string" ? item.note : "");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");

  function submit(event) {
    event.preventDefault();
    if (note.length > NOTE_MAX_LENGTH) {
      setError("La note doit contenir au plus 2000 caractères.");
      setInvalidField("note");
      return;
    }
    const trimmed = title.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TITLE) {
      setError("Le titre doit contenir entre 1 et 300 caractères.");
      setInvalidField("title");
      return;
    }
    setError("");
    setInvalidField("");
    commands.updateItem(subjectId, item.id, {
      title,
      priority,
      note
    });
  }

  return (
    <form className="task-edit-form" onSubmit={submit}>
      <TextField
        className="task-edit-title"
        type="text"
        maxLength={MAX_TITLE}
        required
        value={title}
        ariaLabel={"Titre de l'étape " + item.title}
        ariaInvalid={invalidField === "title"}
        errorId={invalidField === "title" ? "task-edit-error" : undefined}
        onChange={(event) => setTitle(event.target.value)}
      />
      <PriorityControl
        variant="field"
        className="task-edit-priority"
        ariaLabel={"Priorité de l'étape " + item.title}
        value={priority}
        onChange={setPriority}
      />
      <label className="task-edit-note-label">
        Note (facultative)
        <TextField
          as="textarea"
          className="task-edit-note"
          rows={3}
          maxLength={NOTE_MAX_LENGTH}
          value={note}
          ariaLabel={"Note (facultative) de l'étape " + item.title}
          ariaInvalid={invalidField === "note"}
          errorId={invalidField === "note" ? "task-edit-error" : undefined}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <Button variant="primary" type="submit">Enregistrer</Button>
      <Button
        variant="subtle"
        type="button"
        onClick={() => commands.cancelEdit(subjectId, item.id)}
      >
        Annuler
      </Button>
      {error ? <p className="edit-error" id="task-edit-error" role="alert">{error}</p> : null}
    </form>
  );
}

export default TaskEditor;
