import { useState } from "react";
import { Button } from "../ui/Button.jsx";
import { PriorityControl } from "../ui/PriorityControl.jsx";
import { TextField } from "../ui/TextField.jsx";

export function CreateTaskForm({ subject, commands }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");

  function submit(event) {
    event.preventDefault();
    if (!title.trim() || subject.items.length >= 500) return;
    if (commands.createItem(subject.id, title, priority)) {
      setTitle("");
      setPriority("normal");
    }
  }

  return (
    <form className="task-form" data-subject={subject.id} onSubmit={submit}>
      <TextField
        required
        maxLength={300}
        placeholder="Quelle est la prochaine action ?"
        ariaLabel={"Nouvelle étape pour " + subject.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <PriorityControl
        variant="field"
        ariaLabel="Priorité de la nouvelle étape"
        value={priority}
        onChange={setPriority}
      />
      <Button variant="primary" type="submit">+ Étape</Button>
    </form>
  );
}

export default CreateTaskForm;
