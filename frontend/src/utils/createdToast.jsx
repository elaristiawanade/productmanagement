import toast from 'react-hot-toast';

// Success toast for a record that was just created. It shows the code the record was given
// ("Item HRS-098 ditambahkan"), so people know what to look for in the table. Stays a bit longer
// than the default 3 s so the code can be read or copied. Falls back to the plain message when the
// response carries no code.
export function toastCreated(noun, code, verb) {
  if (!code) { toast.success(`${noun} ${verb}`); return; }
  toast.success(
    <span>{noun} <strong className="font-mono">{code}</strong> {verb}</span>,
    { duration: 6000 }
  );
}
