import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import brasao from './brasao-escola.png'; 
import favicon from './favicon.ico';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('Todas');
  const [bimestre, setBimestre] = useState('1º Bimestre'); // Estado do Bimestre

  const fetchAlunos = async () => {
    setCarregando(true);
    try {
      const { data: listaAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      // Busca status filtrando pelo BIMESTRE selecionado
      const { data: listaStatus } = await supabase
        .from('status_pei')
        .select(`status, aluno_id, disciplina_id, bimestre, disciplinas (nome, ordem_exibicao)`)
        .eq('bimestre', bimestre) 
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

  useEffect(() => {
    fetchAlunos();
    document.title = `PEI - ${bimestre}`;
    const link = document.querySelector("link[rel~='icon']");
    if (link) link.href = favicon;
  }, [bimestre]); // Recarrega sempre que mudar o bimestre

  // --- FUNÇÃO PARA SUBIR BACKUP (RESTAURAR) ---
  const importarBackup = (event) => {
    const arquivo = event.target.files[0];
    if (!arquivo) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        alert("⏳ Restaurando dados... Por favor, aguarde.");

        for (const aluno of dados) {
          for (const status of aluno.peiStatus) {
            await supabase.from('status_pei').upsert({
              aluno_id: aluno.id,
              disciplina_id: status.disciplina_id,
              status: status.status,
              bimestre: status.bimestre || bimestre // Usa o bimestre do arquivo ou o atual
            });
          }
        }
        alert("✅ Backup restaurado com sucesso!");
        fetchAlunos();
      } catch (err) {
        alert("❌ Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(arquivo);
  };

  const fazerBackup = () => {
    const dataStr = JSON.stringify(alunos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_pei_${bimestre.replace(' ', '_')}.json`;
    link.click();
  };

  const alternarStatus = async (alunoId, disciplinaId, statusAtual) => {
    const proximos = { 'Não Iniciado': 'Em Correção', 'Em Correção': 'Concluído', 'Concluído': 'Não Iniciado' };
    const novoStatus = proximos[statusAtual] || 'Não Iniciado';

    const { error } = await supabase
      .from('status_pei')
      .upsert({ 
        aluno_id: alunoId, 
        disciplina_id: disciplinaId, 
        status: novoStatus,
        bimestre: bimestre // Salva no bimestre selecionado
      }, { onConflict: ['aluno_id', 'disciplina_id', 'bimestre'] });

    if (!error) fetchAlunos();
  };

  const getBotaoEstilo = (status) => ({
    backgroundColor: status === 'Concluído' ? '#28a745' : status === 'Em Correção' ? '#ffc107' : '#fff',
    color: status === 'Concluído' ? '#fff' : '#333',
    border: '1px solid #ccc',
    borderRadius: '8px',
    padding: '8px 12px',
    margin: '3px',
    fontSize: '13px', 
    fontWeight: 'bold',
    cursor: 'pointer'
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src={brasao} alt="Brasão" style={{ height: '60px' }} />
            <h1 style={{ color: '#1a73e8', margin: 0, fontSize: '22px' }}>Gestão PEI - EEMDP2</h1>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* SELETOR DE BIMESTRE */}
            <select value={bimestre} onChange={(e) => setBimestre(e.target.value)} style={{ padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: '2px solid #1a73e8' }}>
              <option>1º Bimestre</option>
              <option>2º Bimestre</option>
              <option>3º Bimestre</option>
              <option>4º Bimestre</option>
            </select>

            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd' }}>
              {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
          <button onClick={fazerBackup} style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer' }}>💾 Baixar Backup</button>
          
          <label style={{ backgroundColor: '#17a2b8', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            📤 Subir Backup
            <input type="file" accept=".json" onChange={importarBackup} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a73e8', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Estudante</th>
              <th style={{ padding: '15px' }}>Turma</th>
              <th style={{ padding: '15px' }}>Status ({bimestre})</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{aluno.nome}</td>
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
