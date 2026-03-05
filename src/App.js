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
        // 1. Identifica se é Ensino Médio (Turmas que começam com 1, 2 ou 3)
        const turmaLimpa = aluno.turma.trim();
        const ehEnsinoMedio = ['1', '2', '3'].includes(turmaLimpa.charAt(0));
        
        // 2. Filtro "Blindado" de Disciplinas
        const disciplinasFiltradas = listaDisciplinas.filter(disc => {
          // Normaliza o nome para comparar (remove acentos e espaços, fica tudo minúsculo)
          const nomeNormalizado = disc.nome.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          
          // Se for Ensino Médio e a matéria for "ciencias", ela é removida
          if (ehEnsinoMedio && nomeNormalizado === 'ciencias') return false; 
          
          // Se for Fundamental, remove as específicas do Médio
          if (!ehEnsinoMedio && ['fisica', 'quimica', 'biologia', 'sociologia', 'filosofia'].includes(nomeNormalizado)) return false;
          
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
      console.error("Erro ao carregar dados:", error.message);
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
      aluno_id: alunoId, 
      disciplina_id: disciplinaId, 
      status: novoStatus,
      bimestre: bimestre 
    }, { onConflict: ['aluno_id', 'disciplina_id', 'bimestre'] });
  };

  const alunosParaExibir = filtroTurma === 'Todas' ? alunos : alunos.filter(a => a.turma === filtroTurma);
  const totalPeis = alunosParaExibir.reduce((acc, aluno) => acc + aluno.peiStatus.length, 0);
  const concluidos = alunosParaExibir.reduce((acc, aluno) => 
    acc + aluno.peiStatus.filter(s => s.status === 'Concluído').length, 0
  );
  const porcentagem = totalPeis > 0 ? Math.round((concluidos / totalPeis) * 100) : 0;

  // Define a cor da barra de progresso baseada na porcentagem
  const getCorBarra = () => {
    if (porcentagem < 40) return '#dc3545'; // Vermelho
    if (porcentagem < 80) return '#ffc107'; // Amarelo
    return '#28a745'; // Verde
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <header style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <img src={brasao} alt="Brasão" style={{ height: '60px' }} />
            <div>
              <h1 style={{ color: '#1a73e8', margin: 0, fontSize: '22px' }}>Gestão de PEIs - EEMDP2</h1>
              <p style={{ color: '#95a5a6', margin: '5px 0 0 0', fontSize: '13px' }}>{bimestre} | ⚪ Pendente | 🟡 Correção | 🟢 Concluído</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={bimestre} onChange={(e) => setBimestre(e.target.value)} style={{ padding: '10px', borderRadius: '10px', border: '2px solid #1a73e8', fontWeight: 'bold' }}>
              <option>1º Bimestre</option><option>2º Bimestre</option><option>3º Bimestre</option><option>4º Bimestre</option>
            </select>
            <select value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)} style={{ padding: '10px', borderRadius: '10px', border: '1px solid #ddd' }}>
              {['Todas', ...new Set(alunos.map(a => a.turma))].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* BARRA DE PROGRESSO DINÂMICA */}
        <div style={{ marginTop: '10px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            <span>Status da Meta ({filtroTurma})</span>
            <span style={{ color: getCorBarra() }}>{porcentagem}% Concluído</span>
          </div>
          <div style={{ width: '100%', height: '12px', backgroundColor: '#e9ecef', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ width: `${porcentagem}%`, height: '100%', backgroundColor: getCorBarra(), transition: 'all 0.5s ease' }}></div>
          </div>
        </div>
      </header>

      <div style={{ overflowX: 'auto', borderRadius: '15px', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            <tr style={{ backgroundColor: '#1a73e8', color: '#fff', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Estudante</th>
              <th style={{ padding: '15px' }}>Turma</th>
              <th style={{ padding: '15px' }}>Status das Disciplinas</th>
            </tr>
          </thead>
          <tbody>
            {alunosParaExibir.map(aluno => (
              <tr key={aluno.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px 15px', fontWeight: 'bold', color: '#2c3e50' }}>{aluno.nome}</td>
                <td style={{ padding: '12px 15px', color: '#666' }}>{aluno.turma}</td>
                <td style={{ padding: '8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {aluno.peiStatus.map(item => (
                      <button 
                        key={item.disciplina_id} 
                        onClick={() => alternarStatus(aluno.id, item.disciplina_id, item.status)}
                        style={{
                          backgroundColor: item.status === 'Concluído' ? '#28a745' : item.status === 'Em Correção' ? '#ffc107' : '#fff',
                          color: item.status === 'Concluído' ? '#fff' : '#333',
                          border: '1px solid #ccc', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                        }}
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
