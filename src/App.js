import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // 1. Busca os alunos e seus respectivos status de PEI
  const fetchAlunos = async () => {
    setCarregando(true);
    try {
      // Busca alunos, ordenando por turma e nome
      const { data: listaAlunos, error: errorAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      if (errorAlunos) throw errorAlunos;

      // Busca todos os status vinculados e o nome da disciplina
      const { data: listaStatus, error: errorStatus } = await supabase
        .from('status_pei')
        .select(`
          status,
          aluno_id,
          disciplina_id,
          disciplinas (nome)
        `);

      if (errorStatus) throw errorStatus;

      // Cruza os dados: adiciona a lista de status dentro de cada objeto de aluno
      const alunosFormatados = listaAlunos.map(aluno => ({
        ...aluno,
        peiStatus: listaStatus.filter(s => s.aluno_id === aluno.id)
      }));

      setAlunos(alunosFormatados);
    } catch (error) {
      console.error("Erro ao carregar dados:", error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchAlunos();
  }, []);

  // 2. Função para alternar o status ao clicar (Branco -> Amarelo -> Verde)
  const alternarStatus = async (alunoId, disciplinaId, statusAtual) => {
    const proximos = {
      'Não Iniciado': 'Em Correção',
      'Em Correção': 'Concluído',
      'Concluído': 'Não Iniciado'
    };

    const novoStatus = proximos[statusAtual] || 'Não Iniciado';

    const { error } = await supabase
      .from('status_pei')
      .upsert({ 
        aluno_id: alunoId, 
        disciplina_id: disciplinaId, 
        status: novoStatus 
      }, { onConflict: ['aluno_id', 'disciplina_id'] });

    if (!error) {
      // Atualização otimista na tela (sem precisar recarregar tudo do banco)
      setAlunos(prevAlunos => prevAlunos.map(aluno => {
        if (aluno.id === alunoId) {
          return {
            ...aluno,
            peiStatus: aluno.peiStatus.map(s => 
              s.disciplina_id === disciplinaId ? { ...s, status: novoStatus } : s
            )
          };
        }
        return aluno;
      }));
    } else {
      alert("Erro ao salvar: " + error.message);
    }
  };

  // 3. Estilização dinâmica baseada no status
  const getEstiloStatus = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#000',
    border: '1px solid #ccc',
    borderRadius: '15px',
    padding: '4px 10px',
    margin: '3px',
    fontSize: '11px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s'
  });

  if (carregando) return <div style={{ padding: '20px' }}>Carregando sistema de monitoramento...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>📊 Monitoramento de PEI - 2026</h1>
        <button onClick={fetchAlunos} style={{ padding: '10px', cursor: 'pointer' }}>🔄 Atualizar Dados</button>
      </header>
      
      <div style={{ marginBottom: '20px', fontSize: '14px' }}>
        Legenda: ⚪ Não Iniciado | 🟡 Em Correção | 🟢 Concluído
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr style={{ backgroundColor: '#f4f4f4', textAlign: 'left', borderBottom: '2px solid #ddd' }}>
            <th style={{ padding: '12px' }}>Aluno</th>
            <th style={{ padding: '12px' }}>Turma</th>
            <th style={{ padding: '12px' }}>Disciplinas / Status (Clique para mudar)</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map(aluno => (
            <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>{aluno.nome}</td>
              <td style={{ padding: '12px' }}>{aluno.turma}</td>
              <td style={{ padding: '12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {aluno.peiStatus.map(item => (
                    <button
                      key={item.disciplina_id}
                      onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)}
                      style={getEstiloStatus(item.status)}
                    >
                      {item.disciplinas?.nome} {item.status === 'Concluído' ? '🟢' : item.status === 'Em Correção' ? '🟡' : '⚪'}
                    </button>
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

export default App;
