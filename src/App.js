import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Importação das imagens da pasta src
import brasao from './brasao-escola.png'; 
import favicon from './favicon.ico';

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
      console.error("Erro ao carregar:", error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchAlunos();
    document.title = "Gestão de PEIs - EEMDP2";
    const link = document.querySelector("link[rel~='icon']");
    if (link) link.href = favicon;
  }, []);

  // --- FUNÇÃO DE BACKUP (DOWNLOAD JSON) ---
  const fazerBackup = () => {
    const dataHora = new Date().toLocaleString('pt-BR').replace(/\//g, '-').replace(/:/g, 'h').replace(', ', '_');
    const nomeArquivo = `backup_pei_eemdp2_${dataHora}.json`;
    
    const blob = new Blob([JSON.stringify(alunos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = nomeArquivo;
    link.click();
    
    URL.revokeObjectURL(url);
    alert("💾 Backup baixado com sucesso!");
  };

  const copiarEEnviar = () => {
    const alunosFiltrados = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);
    let mensagem = `*📌 PENDÊNCIAS PEI 2026 - EEMDP2*\n\n`;
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
      alert("✅ Relatório copiado!");
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
    });
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

  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '10px 16px',
    margin: '4px',
    fontSize: '14px', 
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>⏳ Carregando...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <style>{`
        .btn-disciplina:hover { filter: brightness(0.9); transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        .header-container {
          background-color: #fff; padding: 20px; border-radius: 15px; margin-bottom: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08); display: flex; justify-content: space-between;
          align-items: center; flex-wrap: wrap; gap: 20px;
        }
      `}</style>

      <header className="header-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={brasao} alt="Brasão" style={{ height: '70px', width: 'auto' }} />
          <div>
            <h1 style={{ color: '#1a73e8', margin: 0, fontSize: '26px' }}>Gestão de PEIs - EEMDP2</h1>
            <p style={{ color: '#95a5a6', margin: '5px 0 0 0' }}>Legenda: ⚪ Pendente | 🟡 Correção | 🟢 Concluído</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
            {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          
          {/* BOTÃO DE BACKUP */}
          <button 
            onClick={fazerBackup} 
            style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            💾 Backup
          </button>

          <button 
            onClick={copiarEEnviar} 
            style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            📱 WhatsApp
          </button>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a73e8', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '20px' }}>Estudante</th>
              <th style={{ padding: '20px' }}>Turma</th>
              <th style={{ padding: '20px' }}>Status por Disciplina</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '18px', fontWeight: 'bold', color: '#2c3e50', minWidth: '250px' }}>{aluno.nome}</td>
                <td style={{ padding: '18px', color: '#666', fontWeight: 'bold' }}>{aluno.turma}</td>
                <td style={{ padding: '10px 18px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus
                      .sort((a, b) => (a.disciplinas?.ordem_exibicao || 0) - (b.disciplinas?.ordem_exibicao || 0))
                      .map(item => (
                        <button 
                          key={item.disciplina_id} 
                          className="btn-disciplina"
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
