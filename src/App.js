import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import brasao from './brasao-escola.png'; 
import favicon from './favicon.ico';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('Todas');
  const [bimestre, setBimestre] = useState('1º Bimestre');

  const fetchAlunos = async (exibirCarregamento = true) => {
    if (exibirCarregamento) setCarregando(true);
    try {
      const { data: listaAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      const { data: listaDisciplinas } = await supabase
        .from('disciplinas')
        .select('*')
        .order('ordem_exibicao', { ascending: true });

      const { data: listaStatus } = await supabase
        .from('status_pei')
        .select(`status, aluno_id, disciplina_id, bimestre`)
        .eq('bimestre', bimestre);

      const alunosFormatados = listaAlunos.map(aluno => {
        const ehEnsinoMedio = ['1', '2', '3'].includes(aluno.turma.trim().charAt(0));
        
        const disciplinasFiltradas = listaDisciplinas.filter(disc => {
          const nome = disc.nome.toLowerCase();
          if (ehEnsinoMedio && (nome.includes('ciencia') || nome === 'ciências')) return false;
          if (!ehEnsinoMedio && ['física', 'química', 'biologia', 'sociologia', 'filosofia'].includes(nome)) return false;
          return true;
        });

        const peiStatusDoAluno = disciplinasFiltradas.map(disc => {
          const statusSalvo = listaStatus?.find(s => s.aluno_id === aluno.id && s.disciplina_id === disc.id);
          return {
            disciplina_id: disc.id,
            status: statusSalvo ? statusSalvo.status : 'Não Iniciado',
            disciplinas: disc
          };
        });
        return { ...aluno, peiStatus: peiStatusDoAluno };
      });

      setAlunos(alunosFormatados);
    } catch (error) {
      console.error("Erro:", error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchAlunos();
    document.title = `PEI - ${bimestre}`;
    const link = document.querySelector("link[rel~='icon']");
    if (link) link.href = favicon;
  }, [bimestre]);

  const alternarStatus = async (alunoId, disciplinaId, statusAtual) => {
    const proximos = { 'Não Iniciado': 'Em Correção', 'Em Correção': 'Concluído', 'Concluído': 'Não Iniciado' };
    const novoStatus = proximos[statusAtual] || 'Não Iniciado';

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

    await supabase.from('status_pei').upsert({ 
      aluno_id: alunoId, disciplina_id: disciplinaId, status: novoStatus, bimestre: bimestre 
    }, { onConflict: ['aluno_id', 'disciplina_id', 'bimestre'] });
  };

  // MODELO DE MENSAGEM WHATSAPP SOLICITADO
  const copiarEEnviar = () => {
    const alunosFiltrados = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);
    let mensagem = `*📌 PENDÊNCIAS PEI 2026 - ${bimestre}*\n\n`;
    
    const turmasUnicas = [...new Set(alunosFiltrados.map(a => a.turma))].sort();

    turmasUnicas.forEach(turma => {
      const alunosDaTurma = alunosFiltrados.filter(a => a.turma === turma);
      let temPendenciaNaTurma = false;
      let blocoTurma = `📍 *TURMA: ${turma}*\n`;

      alunosDaTurma.forEach(aluno => {
        const faltantes = aluno.peiStatus
          .filter(s => s.status !== 'Concluído')
          .map(s => s.disciplinas.nome);

        if (faltantes.length > 0) {
          blocoTurma += `• *${aluno.nome}* (${faltantes.join(', ')})\n`;
          temPendenciaNaTurma = true;
        }
      });

      if (temPendenciaNaTurma) {
        mensagem += blocoTurma + `\n`;
      }
    });

    navigator.clipboard.writeText(mensagem).then(() => {
      alert("✅ Relatório copiado no novo formato!");
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
    });
  };

  const fazerBackup = () => {
    const blob = new Blob([JSON.stringify(alunos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_pei_${bimestre}.json`;
    link.click();
  };

  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);
  const total = alunosParaExibir.reduce((acc, a) => acc + a.peiStatus.length, 0);
  const concluidos = alunosParaExibir.reduce((acc, a) => acc + a.peiStatus.filter(s => s.status === 'Concluído').length, 0);
  const porc = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>⏳ Carregando {bimestre}...</div>;

  return (
    <div style={{ padding: '15px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src={brasao} alt="Escola" style={{ height: '55px' }} />
            <h1 style={{ color: '#1a73e8', margin: 0, fontSize: '20px' }}>Gestão PEI - EEMDP2</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={bimestre} onChange={(e) => setBimestre(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '2px solid #1a73e8', fontWeight: 'bold', cursor: 'pointer' }}>
              <option>1º Bimestre</option><option>2º Bimestre</option><option>3º Bimestre</option><option>4º Bimestre</option>
            </select>
            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #ddd', cursor: 'pointer' }}>
              <option>Todas</option>
              {[...new Set(alunos.map(a => a.turma))].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={fazerBackup} style={{ backgroundColor: '#6c757d', color: '#fff', padding: '12px 20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', flex: '1' }}>💾 Backup</button>
          <button onClick={copiarEEnviar} style={{ backgroundColor: '#25D366', color: '#fff', padding: '12px 20px', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', flex: '1' }}>📱 WhatsApp</button>
        </div>

        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
            <span>Progresso Geral</span>
            <span style={{ color: porc < 50 ? '#dc3545' : '#28a745' }}>{porc}% ({concluidos}/{total})</span>
          </div>
          <div style={{ width: '100%', height: '12px', backgroundColor: '#eee', borderRadius: '6px' }}>
            <div style={{ width: `${porc}%`, height: '100%', backgroundColor: porc < 50 ? '#dc3545' : '#28a745', borderRadius: '6px', transition: '0.6s ease-in-out' }}></div>
          </div>
        </div>
      </header>

      <div style={{ backgroundColor: '#fff', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#1a73e8', color: '#fff' }}>
            <tr>
              <th style={{ padding: '15px', textAlign: 'left', fontSize: '14px' }}>Estudante / Turma</th>
              <th style={{ padding: '15px', textAlign: 'left', fontSize: '14px' }}>Status das Disciplinas</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px' }}>
                  <div style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '15px' }}>{aluno.nome}</div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>Turma: {aluno.turma}</div>
                </td>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {aluno.peiStatus.map(s => (
                      <button 
                        key={s.disciplina_id} 
                        onClick={() => alternarStatus(aluno.id, s.disciplina_id, s.status)}
                        style={{
                          backgroundColor: s.status === 'Concluído' ? '#28a745' : s.status === 'Em Correção' ? '#ffc107' : '#fff',
                          color: s.status === 'Concluído' ? '#fff' : '#333',
                          border: '1.5px solid #ccc', 
                          padding: '12px 16px', // BOTÕES MAIORES PARA CELULAR
                          borderRadius: '10px', 
                          cursor: 'pointer', 
                          fontSize: '13px', 
                          fontWeight: 'bold',
                          minWidth: '100px',
                          textAlign: 'center'
                        }}
                      >
                        {s.disciplinas.nome}
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
