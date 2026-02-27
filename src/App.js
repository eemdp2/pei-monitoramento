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
        .select(`
          status, 
          aluno_id, 
          disciplina_id, 
          disciplinas (nome, ordem_exibicao)
        `)
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

  const enviarRelatorioWhatsapp = () => {
    const alunosFiltrados = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);
    let mensagem = `*📌 RELATÓRIO DE PENDÊNCIAS PEI 2026*\n\n`;
    const turmasAgrupadas = {};

    alunosFiltrados.forEach(aluno => {
      const faltantes = aluno.peiStatus
        .filter(item => item.status !== 'Concluído')
        .sort((a, b) => (a.disciplinas?.ordem_exibicao || 0) - (b.disciplinas?.ordem_exibicao || 0))
        .map(item => item.disciplinas.nome);

      if (faltantes.length > 0) {
        if (!turmasAgrupadas[aluno.turma]) turmasAgrupadas[aluno.turma] = [];
        turmasAgrupadas[aluno.turma].push(`• *${aluno.nome}* (${faltantes.join(', ')})`);
      }
    });

    Object.keys(turmasAgrupadas).sort().forEach(turma => {
      mensagem += `📍 *TURMA: ${turma}*\n${turmasAgrupadas[turma].join('\n')}\n\n`;
    });

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
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

  // --- AJUSTE DE TAMANHO DOS BOTÕES ---
  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '8px 14px', // Aumentado para melhor clique
    margin: '4px',
    fontSize: '13px',    // Aumentado de 10px para 13px para leitura no PC
    fontWeight: 'bold',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>⏳ Carregando Painel...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>📊 Gestão de PEIs - EEMDP2</h1>
          <p style={{ color: '#95a5a6', margin: '5px 0 0 0' }}>⚪ Pendente | 🟡 Correção | 🟢 Concluído</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={enviarRelatorioWhatsapp} style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            📱 Enviar Faltantes
          </button>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '18px' }}>Estudante</th>
              <th style={{ padding: '18px' }}>Turma</th>
              <th style={{ padding: '18px' }}>Disciplinas (Clique para alterar)</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold', minWidth: '200px' }}>{aluno.nome}</td>
                <td style={{ padding: '15px' }}>{aluno.turma}</td>
                <td style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus
                      .sort((a, b) => (a.disciplinas?.ordem_exibicao || 0) - (b.disciplinas?.ordem_exibicao || 0))
                      .map(item => (
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
