import React from 'react';

interface EntryBoxProps {
  value1: string;
  value2: string;
  onChange1: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChange2: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const EntryBox: React.FC<EntryBoxProps> = ({ value1, value2, onChange1, onChange2 }) => (
  <div style={{ marginBottom: '1rem' }}>
    <input type="text" value={value1} onChange={onChange1} placeholder="Entry 1" />
    <input type="text" value={value2} onChange={onChange2} placeholder="Entry 2" style={{ marginLeft: '0.5rem' }} />
  </div>
);

export default EntryBox;