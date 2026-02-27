import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  // 1. Busca os dados no banco com a nova ordenação automática
  const fetchAlunos = async () => {
    setCarregando(true);
    try {
      // Busca lista de alunos ordenada por turma e nome
      const { data: listaAlunos, error: errorAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      if (errorAlunos) throw errorAlunos;

      // Busca os status já ordenados pela coluna 'ordem_exibicao' da tabela disciplinas
      const { data: listaStatus, error: errorStatus } = await supabase
        .from('status_pei')
        .select(`
          status,
          aluno_id,
          disciplina_id,
          disciplinas (nome, ordem_exibicao)
        `)
        .order('ordem_exibicao', { foreignTable: 'disciplinas', ascending: true });

      if (errorStatus) throw errorStatus;

      // Cruza os dados: insere os status dentro de cada aluno
      const alunosFormatados = listaAlunos.map(aluno => ({
        ...aluno,
        peiStatus: listaStatus.filter(s => s.aluno_id === aluno.id)
      }));

      setAlunos(alunosFormatados);
    } catch (error) {
      console.error("Erro na busca:", error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchAlunos();
  }, []);

  // 2. Função para alternar status (Branco -> Amarelo -> Verde)
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
      // Atualização imediata na tela para melhor experiência do usuário
      setAlunos(prev => prev.map(aluno => {
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
    }
  };

  // 3. Estilos dos botões
  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc',
    borderRadius: '20px',
    padding: '6px 12px',
    margin: '3px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  });

  if (carregando) return <div style={{ padding: '30px' }}>⏳ Carregando monitoramento...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9f9f9', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h1 style={{ color: '#2c3e50', margin: 0 }}>📊 Monitoramento PEI 2026</h1>
        <p style={{ color: '#7f8c8d' }}>Escola EEMDP2 - Legenda: ⚪ Pendente | 🟡 Correção | 🟢 OK</p>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Aluno</th>
              <th style={{ padding: '15px' }}>Turma</th>
              <th style={{ padding: '15px' }}>Disciplinas (Sequência Prioritária)</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold', color: '#34495e' }}>{aluno.nome}</td>
                <td style={{ padding: '15px', color: '#7f8c8d' }}>{aluno.turma}</td>
                <td style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus.map(item => (
                      <button
                        key={item.disciplina_id}
                        onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)}
                        style={getBotaoEstilo(item.status)}
                        title="Clique para alternar o status"
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
    </div>
  );
}

export default App;
