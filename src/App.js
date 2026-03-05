import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Importação das imagens da pasta src
import brasao from './brasao-escola.png'; 
import favicon from './favicon.ico';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('Todas');
  const [bimestre, setBimestre] = useState('1º Bimestre');

  const fetchAlunos = async () => {
    setCarregando(true);
    try {
      // 1. Busca TODOS os alunos para garantir que nomes e turmas apareçam
      const { data: listaAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      // 2. Busca as disciplinas para montar a estrutura dos botões
      const { data: listaDisciplinas } = await supabase
        .from('disciplinas')
        .select('*')
        .order('ordem_exibicao', { ascending: true });

      // 3. Busca os status filtrando pelo BIMESTRE selecionado
      const { data: listaStatus } = await supabase
        .from('status_pei')
        .select(`status, aluno_id, disciplina_id, bimestre`)
        .eq('bimestre', bimestre);

      // 4. Cruzamento de dados: Garante que o aluno apareça mesmo sem status no bimestre
      const alunosFormatados = listaAlunos.map(aluno => {
        const peiStatusDoAluno = listaDisciplinas.map(disc => {
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
      console.error("Erro ao carregar dados:", error.message);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    fetchAlunos();
    document.title = `PEI - ${bimestre}`;
    const link = document.querySelector("link[rel~='icon']");
    if (link) link.href = favicon; // Define o ícone da aba
  }, [bimestre]);

  const alternarStatus = async (alunoId, disciplinaId, statusAtual) => {
    const proximos = { 'Não Iniciado': 'Em Correção', 'Em Correção': 'Concluído', 'Concluído': 'Não Iniciado' };
    const novoStatus = proximos[statusAtual] || 'Não Iniciado';

    const { error } = await supabase
      .from('status_pei')
      .upsert({ 
        aluno_id: alunoId, 
        disciplina_id: disciplinaId, 
        status: novoStatus,
        bimestre: bimestre 
      }, { onConflict: ['aluno_id', 'disciplina_id', 'bimestre'] });

    if (!error) fetchAlunos();
  };

  const copiarEEnviar = () => {
    const alunosFiltrados = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);
    let mensagem = `*📌 PENDÊNCIAS PEI 2026 - ${bimestre}*\n\n`;
    const turmasAgrupadas = {};

    alunosFiltrados.forEach(aluno => {
      const faltantes = aluno.peiStatus
        .filter(item => item.status !== 'Concluído')
        .map(item => item.disciplinas.nome);

      if (faltantes.length > 0) {
        if (!turmasAgrupadas[aluno.turma]) turmasAgrupadas[aluno.turma] = [];
        turmasAgrupadas[aluno.turma].push(`• *${aluno.nome}* (${faltantes.join(', ')})`);
      }
    });

    Object.keys(turmasAgrupadas).sort().forEach(t => {
      mensagem += `📍 *TURMA: ${t}*\n${turmasAgrupadas[t].join('\n')}\n\n`;
    });

    navigator.clipboard.writeText(mensagem).then(() => {
      alert("✅ Relatório copiado!");
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`, '_blank');
    });
  };

  const fazerBackup = () => {
    const blob = new Blob([JSON.stringify(alunos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_pei_${bimestre.replace(' ', '_')}.json`;
    link.click();
  };

  const importarBackup = (event) => {
    const arquivo = event.target.files[0];
    if (!arquivo) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        for (const aluno of dados) {
          for (const s of aluno.peiStatus) {
             if (s.status !== 'Não Iniciado') {
                await supabase.from('status_pei').upsert({
                  aluno_id: aluno.id,
                  disciplina_id: s.disciplina_id,
                  status: s.status,
                  bimestre: bimestre
                });
             }
          }
        }
        alert("✅ Backup restaurado para este bimestre!");
        fetchAlunos();
      } catch (err) { alert("❌ Erro no arquivo."); }
    };
    reader.readAsText(arquivo);
  };

  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc', borderRadius: '8px', padding: '10px 16px', margin: '4px',
    fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>⏳ Carregando {bimestre}...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <style>{`
        .btn-disciplina:hover { filter: brightness(0.9); transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
      `}</style>

      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img src={brasao} alt="Brasão" style={{ height: '70px' }} />
            <div>
              <h1 style={{ color: '#1a73e8', margin: 0, fontSize: '26px' }}>Gestão de PEIs - EEMDP2</h1>
              <p style={{ color: '#95a5a6', margin: '5px 0 0 0' }}>Legenda: ⚪ Pendente | 🟡 Correção | 🟢 Concluído</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select value={bimestre} onChange={(e) => setBimestre(e.target.value)} style={{ padding: '12px', borderRadius: '10px', fontWeight: 'bold', border: '2px solid #1a73e8', cursor: 'pointer' }}>
              <option>1º Bimestre</option><option>2º Bimestre</option><option>3º Bimestre</option><option>4º Bimestre</option>
            </select>
            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
              {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <button onClick={fazerBackup} style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Baixar Backup</button>
          <label style={{ backgroundColor: '#17a2b8', color: '#fff', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
            📤 Subir Backup <input type="file" accept=".json" onChange={importarBackup} style={{ display: 'none' }} />
          </label>
          <button onClick={copiarEEnviar} style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>📱 WhatsApp</button>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a73e8', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '20px' }}>Estudante</th>
              <th style={{ padding: '20px' }}>Turma</th>
              <th style={{ padding: '20px' }}>Status ({bimestre})</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '18px', fontWeight: 'bold', color: '#2c3e50', minWidth: '250px' }}>{aluno.nome}</td>
                <td style={{ padding: '18px', color: '#666', fontWeight: 'bold' }}>{aluno.turma}</td>
                <td style={{ padding: '10px 18px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus.map(item => (
                      <button key={item.disciplina_id} className="btn-disciplina" onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)} style={getBotaoEstilo(item.status)}>
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
