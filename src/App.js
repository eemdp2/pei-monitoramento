import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(true);

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

  // --- NOVA FUNÇÃO: GERAR MENSAGEM WHATSAPP ---
  const enviarRelatorioWhatsapp = () => {
    let mensagem = "*Relatório de PEIs Pendentes - 2026*\n\n";
    let possuiPendenciaGeral = false;

    // Agrupar pendências por disciplina para facilitar para os professores
    const pendenciasPorDisciplina = {};

    alunos.forEach(aluno => {
      aluno.peiStatus.forEach(item => {
        if (item.status !== 'Concluído') {
          const nomeDisc = item.disciplinas.nome;
          if (!pendenciasPorDisciplina[nomeDisc]) pendenciasPorDisciplina[nomeDisc] = [];
          pendenciasPorDisciplina[nomeDisc].push(`${aluno.nome} (${aluno.turma}) - *${item.status}*`);
          possuiPendenciaGeral = true;
        }
      });
    });

    if (!possuiPendenciaGeral) {
      alert("🎉 Todos os PEIs de todos os alunos foram concluídos!");
      return;
    }

    for (const disc in pendenciasPorDisciplina) {
      mensagem += `📚 *${disc}:*\n`;
      pendenciasPorDisciplina[disc].forEach(p => { mensagem += `• ${p}\n`; });
      mensagem += `\n`;
    }

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
  };
  // ------------------------------------------

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
    border: '1px solid #ccc', borderRadius: '20px', padding: '6px 12px', margin: '3px', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
  });

  if (carregando) return <div style={{ padding: '30px' }}>⏳ Carregando...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9f9f9', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ color: '#2c3e50', margin: 0 }}>📊 Monitoramento PEI 2026</h1>
          <p style={{ color: '#7f8c8d', margin: 0 }}>Escola EEMDP2</p>
        </div>
        
        {/* BOTÃO DO WHATSAPP */}
        <button 
          onClick={enviarRelatorioWhatsapp}
          style={{ 
            backgroundColor: '#25D366', color: '#fff', border: 'none', padding: '12px 20px', 
            borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
          }}
        >
          📱 Enviar Pendências p/ WhatsApp
        </button>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ backgroundColor: '#2c3e50', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Aluno</th>
              <th style={{ padding: '15px' }}>Turma</th>
              <th style={{ padding: '15px' }}>Disciplinas</th>
            </tr>
          </thead>
          <tbody>
            {alunos.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{aluno.nome}</td>
                <td style={{ padding: '15px' }}>{aluno.turma}</td>
                <td style={{ padding: '15px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {aluno.peiStatus.map(item => (
                      <button key={item.disciplina_id} onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)} style={getBotaoEstilo(item.status)}>
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
