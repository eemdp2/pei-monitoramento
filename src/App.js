import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('Todas');

  const fetchAlunos = async () => {
    setCarregando(true);
    try {
      const { data: listaAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      const { data: listaStatus } = await supabase
        .from('status_pei')
        .select(`status, aluno_id, disciplina_id, disciplinas (nome, ordem_exibicao)`)
        .order('ordem_exibicao', { foreignTable: 'disciplinas', ascending: true });

      const alunosFormatados = listaAlunos.map(aluno => ({
        ...aluno,
        peiStatus: listaStatus.filter(s => s.aluno_id === aluno.id)
      }));

      setAlunos(alunosFormatados);
    } catch (error) {
      console.error("Erro:", error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { fetchAlunos(); }, []);

  // --- FUNÇÃO DE MENSAGEM AGRUPADA POR DISCIPLINA ---
  const enviarRelatorioWhatsapp = () => {
    const alunosFiltrados = filtroTurma === 'Todas' 
      ? alunos 
      : alunos.filter(a => a.turma === filtroTurma);

    let mensagem = `*PENDÊNCIAS PEI 2026 - ${filtroTurma.toUpperCase()}*\n\n`;
    const pendenciasPorDisciplina = {};

    alunosFiltrados.forEach(aluno => {
      aluno.peiStatus.forEach(item => {
        if (item.status !== 'Concluído') {
          const nomeDisc = item.disciplinas.nome;
          if (!pendenciasPorDisciplina[nomeDisc]) pendenciasPorDisciplina[nomeDisc] = [];
          pendenciasPorDisciplina[nomeDisc].push(`${aluno.nome} (${aluno.turma})`);
        }
      });
    });

    if (Object.keys(pendenciasPorDisciplina).length === 0) {
      alert("🎉 Nenhuma pendência encontrada para este filtro!");
      return;
    }

    // Montando o corpo da mensagem
    for (const disc in pendenciasPorDisciplina) {
      mensagem += `📚 *${disc.toUpperCase()}*\n`;
      pendenciasPorDisciplina[disc].forEach(nome => {
        mensagem += `• ${nome}\n`;
      });
      mensagem += `\n`;
    }

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

  const alternarStatus = async (alunoId, disciplinaId, statusAtual) => {
    const proximos = { 'Não Iniciado': 'Em Correção', 'Em Correção': 'Concluído', 'Concluído': 'Não Iniciado' };
    const novoStatus = proximos[statusAtual] || 'Não Iniciado';

    const { error } = await supabase
      .from('status_pei')
      .upsert({ aluno_id: alunoId, disciplina_id: disciplinaId, status: novoStatus }, { onConflict: ['aluno_id', 'disciplina_id'] });

    if (!error) {
      setAlunos(prev => prev.map(aluno => aluno.id === alunoId ? {
        ...aluno,
        peiStatus: aluno.peiStatus.map(s => s.disciplina_id === disciplinaId ? { ...s, status: novoStatus } : s)
      } : aluno));
    }
  };

  // Cores e Estilos
  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc', borderRadius: '20px', padding: '6px 12px', margin: '3px', fontSize: '10px', fontWeight: '600', cursor: 'pointer'
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  if (carregando) return <div style={{ padding: '30px' }}>⏳ Carregando dados...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h1 style={{ color: '#1a73e8', margin: '0 0 10px 0' }}>📊 Gestão de PEIs - EEMDP2</h1>
        
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Filtrar Turma:</label>
            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '8px', borderRadius: '5px' }}>
              {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <button onClick={enviarRelatorioWhatsapp} style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📱 Enviar Pendências {filtroTurma !== 'Todas' ? `da ${filtroTurma}` : ''}
          </button>
        </div>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a73e8', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Estudante</th>
              <th style={{ padding: '15px' }}>Turma</th>
              <th style={{ padding: '15px' }}>Status por Disciplina (Clique para alterar)</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: '600' }}>{aluno.nome}</td>
                <td style={{ padding: '15px' }}>{aluno.turma}</td>
                <td style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus.map(item => (
                      <button key={item.disciplina_id} onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)} style={getBotaoEstilo(item.status)}>
                        {item.disciplinas?.nome}
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
