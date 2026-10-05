export default function Notice({ notice }) {
  if (!notice) return null;
  return <div className={`notice ${notice.type || 'success'}`}>{notice.message}</div>;
}

