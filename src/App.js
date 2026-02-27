import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient'; // Conexão que você configurou

function App() {
  const [alunos, setAlunos] = useState([]);

  // Disciplinas por segmento
  const discFundamental = ["Arte", "Ciências", "Ed. Física", "Geografia", "História", "Inglês", "Matemática", "Português"];
  const discMedio = ["Arte", "Química", "Física", "Biologia", "Ed. Física", "Geografia", "História", "Inglês", "Matemática", "Português", "Filosofia", "Sociologia"];

  useEffect(() => {
    fetchAlunos();
  }, []);

  async function fetchAlunos() {
    const { data } = await supabase.from('alunos').select('*').order('turma', { ascending: true });
    setAlunos(data);
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>📊 Monitoramento de PEI - 2026</h1>
      <hr />

      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead style={{ backgroundColor: '#f4f4f4' }}>
          <tr>
            <th>Aluno</th>
            <th>Turma</th>
            <th>Disciplinas / Status</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map(aluno => (
            <tr key={aluno.id}>
              <td><strong>{aluno.nome}</strong></td>
              <td>{aluno.turma}</td>
              <td>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {(aluno.segmento === 'Medio' ? discMedio : discFundamental).map(disc => (
                    <span key={disc} style={statusBadgeStyle}>
                      {disc}: ⚪
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const statusBadgeStyle = {
  padding: '5px 10px',
  borderRadius: '15px',
  border: '1px solid #ccc',
  fontSize: '12px',
  backgroundColor: '#fff'
};

export default App;
