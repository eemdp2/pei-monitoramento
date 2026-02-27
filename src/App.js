import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTurma, setFiltroTurma] = useState('Todas');

  const fetchAlunos = async () => {
    setCarregando(true);
    try {
      // 1. Busca Alunos
      const { data: listaAlunos } = await supabase
        .from('alunos')
        .select('*')
        .order('turma', { ascending: true })
        .order('nome', { ascending: true });

      // 2. Busca Status com a ordem correta das disciplinas
      const { data: listaStatus } = await supabase
        .from('status_pei')
        .select(`
          status, 
          aluno_id, 
          disciplina_id, 
          disciplinas (nome, ordem_exibicao)
        `)
        .order('ordem_exibicao', { foreignTable: 'disciplinas', ascending: true });

      // 3. Formata os dados
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

  useEffect(() => { fetchAlunos(); }, []);

  // --- FUNÇÃO WHATSAPP: AGRUPADO POR TURMA (NOME + MATÉRIAS FALTANTES) ---
  const enviarRelatorioWhatsapp = () => {
    const alunosFiltrados = filtroTurma === 'Todas' 
      ? alunos 
      : alunos.filter(a => a.turma === filtroTurma);

    let mensagem = `*📌 RELATÓRIO DE PENDÊNCIAS PEI 2026*\n`;
    mensagem += `_Escola EEMDP2 - Gerado em ${new Date().toLocaleDateString('pt-BR')}_\n\n`;

    const turmasAgrupadas = {};

    alunosFiltrados.forEach(aluno => {
      // Pega apenas o nome das matérias que NÃO estão como "Concluído"
      const faltantes = aluno.peiStatus
        .filter(item => item.status !== 'Concluído')
        .map(item => item.disciplinas.nome);

      if (faltantes.length > 0) {
        if (!turmasAgrupadas[aluno.turma]) {
          turmasAgrupadas[aluno.turma] = [];
        }
        // Exemplo: • AMARILDO (Português, Arte, Inglês)
        turmasAgrupadas[aluno.turma].push(`• *${aluno.nome}* (${faltantes.join(', ')})`);
      }
    });

    if (Object.keys(turmasAgrupadas).length === 0) {
      alert("🎉 Parabéns! Não existem pendências para este filtro.");
      return;
    }

    // Monta a mensagem final percorrendo as turmas encontradas
    Object.keys(turmasAgrupadas).sort().forEach(turma => {
      mensagem += `📍 *TURMA: ${turma}*\n`;
      turmasAgrupadas[turma].forEach(linha => {
        mensagem += `${linha}\n`;
      });
      mensagem += `\n`;
    });

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };

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
    borderRadius: '15px',
    padding: '5px 10px',
    margin: '2px',
    fontSize: '10px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: '0.2s'
  });

  const turmasUnicas = ['Todas', ...new Set(alunos.map(a => a.turma))];
  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);

  if (carregando) return <div style={{ padding: '50px', textAlign: 'center' }}>⏳ Sincronizando com o banco de dados...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f4f7f6', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: 0, fontSize: '24px' }}>📊 Monitoramento PEI 2026</h1>
          <p style={{ color: '#95a5a6', margin: '5px 0 0 0' }}>Legenda: ⚪ Pendente | 🟡 Correção | 🟢 Concluído</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select 
            value={filtroTurma} 
            onChange={(e) => setFiltroTurma(e.target.value)} 
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer' }}
          >
            {turmasUnicas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          <button 
            onClick={enviarRelatorioWhatsapp}
            style={{ backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            📱 Enviar Faltantes via WhatsApp
          </button>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '18px' }}>Estudante</th>
              <th style={{ padding: '18px' }}>Turma</th>
              <th style={{ padding: '18px' }}>Disciplinas (Clique para mudar)</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
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
