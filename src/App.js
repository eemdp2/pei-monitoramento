import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('Todas');
  const [senhaInput, setSenhaInput] = useState('');
  const SENHA_MESTRA = 'escola2026'; // <--- Altere sua senha aqui

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

  const verificarAcesso = () => {
    if (senhaInput !== SENHA_MESTRA) {
      alert("⚠️ Senha incorreta ou não informada! A edição está bloqueada.");
      return false;
    }
    return true;
  };

  const copiarEEnviar = () => {
    if (!verificarAcesso()) return;
    
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

    navigator.clipboard.writeText(mensagem).then(() => {
      alert("✅ Relatório copiado! Abrindo WhatsApp...");
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
    });
  };

  const alternarStatus = async (alunoId, disciplinaId, statusAtual) => {
    if (!verificarAcesso()) return;

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

  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '8px 14px',
    margin: '4px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: senhaInput === SENHA_MESTRA ? 'pointer' : 'not-allowed',
    transition: 'transform 0.1s, filter 0.2s',
    opacity: senhaInput === SENHA_MESTRA ? 1 : 0.7
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>⏳ Carregando Painel Seguro...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <style>{`
        button:hover { filter: ${senhaInput === SENHA_MESTRA ? 'brightness(0.9)' : 'none'}; transform: ${senhaInput === SENHA_MESTRA ? 'scale(1.02)' : 'none'}; }
      `}</style>

      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>📊 PEI EEMDP2 - 2026</h1>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
             <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#e74c3c' }}>🔐 Senha de Edição:</span>
             <input 
               type="password" 
               placeholder="Digite aqui..." 
               value={senhaInput} 
               onChange={(e) => setSenhaInput(e.target.value)}
               style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}
             />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button 
            onClick={copiarEEnviar} 
            style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            📋 Copiar e Enviar
          </button>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '18px' }}>Estudante</th>
              <th style={{ padding: '18px' }}>Turma</th>
              <th style={{ padding: '15px' }}>Disciplinas</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold', minWidth: '220px' }}>{aluno.nome}</td>
                <td style={{ padding: '15px' }}>{aluno.turma}</td>
                <td style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus
                      .sort((a, b) => (a.disciplinas?.ordem_exibicao || 0) - (b.disciplinas?.ordem_exibicao || 0))
                      .map(item => (
                        <button 
                          key={item.disciplina_id} 
                          onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)} 
                          style={getBotaoEstilo(item.status)}
                        >
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
