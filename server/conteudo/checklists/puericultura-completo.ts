import type { TemplateSemente } from './tipos.js'

/**
 * O primeiro ano, para quem está vivendo o primeiro ano.
 *
 * Mesma régua do checklist da gestante: quem lê está sem dormir, com um bebê no
 * colo, no celular. Frases curtas, e nunca um alarme sem o próximo passo junto.
 *
 * A janela aqui é em **meses de vida**, não em semanas — por isso `desdeMes`.
 */
export const puericulturaCompleto: TemplateSemente = {
  chave: 'puericultura-completo',
  versao: 1,
  programa: 'materno-infantil',
  publico: 'familia',
  fase: 'pos-natal',
  titulo: 'O primeiro ano do seu bebê',
  descricao:
    'As consultas, as vacinas e os marcos — no ritmo dele, e sem transformar isso em cobrança.',
  icone: 'bebe',

  grupos: [
    {
      id: 'primeira-semana',
      titulo: 'A primeira semana',
      resumo: 'Os testes da maternidade e a primeira consulta.',
      icone: 'estrela',
      explicacaoLeiga:
        'Nos primeiros dias acontecem os testes de triagem: o do pezinho, o da orelhinha, o do olhinho e o do coraçãozinho. Todos procuram condições que são raras, mas que mudam completamente de rumo quando encontradas cedo. O do pezinho tem hora certa — entre o 3º e o 5º dia de vida — porque antes disso o resultado não é confiável.',
      porqueImporta:
        'São exames rápidos que, nas poucas vezes em que encontram algo, evitam consequências graves e permanentes.',
      fonte: 'Ministério da Saúde — Caderneta da Criança, triagem neonatal.',
      janela: { desdeMes: 0, ateMes: 1 },
      lembrete: { antecedenciaDias: 1, canal: 'inapp', repetirDias: 2 },
      passos: [
        { id: 'pezinho', titulo: 'Teste do pezinho (3º ao 5º dia)' },
        { id: 'orelhinha', titulo: 'Teste da orelhinha' },
        { id: 'olhinho', titulo: 'Teste do olhinho' },
        { id: 'coracaozinho', titulo: 'Teste do coraçãozinho' },
        {
          id: 'primeira-consulta-bebe',
          titulo: 'Primeira consulta na primeira semana',
          explicacaoLeiga:
            'Serve para pesar, ver a amamentação e a icterícia (aquele amarelinho). É a consulta que mais pega coisa simples antes de virar problema.',
        },
      ],
    },

    {
      id: 'consultas-primeiro-ano',
      titulo: 'Manter as consultas em dia',
      resumo: 'O calendário de puericultura.',
      icone: 'calendario',
      explicacaoLeiga:
        'As consultas do primeiro ano seguem um ritmo: primeira semana, 1 mês, 2, 4, 6, 9 e 12 meses. Em cada uma o pediatra pesa, mede, olha os marcos do desenvolvimento e atualiza as vacinas. Elas parecem muitas, mas o primeiro ano é quando mais coisa muda — e o crescimento só conta a história quando você tem os pontos ao longo do tempo, não um número solto.',
      porqueImporta:
        'A curva de crescimento é feita de pontos. Um ponto isolado não diz quase nada; a sequência diz quase tudo.',
      fonte: 'Sociedade Brasileira de Pediatria e Ministério da Saúde — calendário de puericultura.',
      janela: { desdeMes: 0, ateMes: 12 },
      lembrete: { antecedenciaDias: 7, canal: 'inapp', repetirDias: 14 },
      passos: [
        { id: 'consulta-1m', titulo: 'Consulta de 1 mês' },
        { id: 'consulta-2m', titulo: 'Consulta de 2 meses' },
        { id: 'consulta-4m', titulo: 'Consulta de 4 meses' },
        { id: 'consulta-6m', titulo: 'Consulta de 6 meses' },
        { id: 'consulta-9m', titulo: 'Consulta de 9 meses' },
        { id: 'consulta-12m', titulo: 'Consulta de 12 meses' },
      ],
    },

    {
      id: 'vacinas-bebe',
      titulo: 'Seguir o calendário de vacinas',
      resumo: 'As doses do PNI, do nascimento ao primeiro ano.',
      icone: 'seringa',
      explicacaoLeiga:
        'O calendário de vacinas do primeiro ano é o mais cheio da vida inteira, e não é por acaso: é a fase de maior risco para várias doenças. Algumas vacinas precisam de mais de uma dose porque a proteção se constrói em etapas — pular uma não "adianta" o processo, atrasa. Febre baixa e o bracinho dolorido nas 48 horas seguintes são reação esperada.',
      porqueImporta:
        'Uma dose atrasada deixa uma janela aberta exatamente na idade em que a doença é mais grave.',
      fonte: 'Ministério da Saúde — Programa Nacional de Imunizações (PNI).',
      janela: { desdeMes: 0, ateMes: 12 },
      lembrete: { antecedenciaDias: 5, canal: 'inapp', repetirDias: 7 },
      passos: [
        { id: 'vacinas-nascer', titulo: 'BCG e hepatite B, ainda na maternidade' },
        { id: 'vacinas-2m', titulo: 'Doses de 2 meses' },
        { id: 'vacinas-4m', titulo: 'Doses de 4 meses' },
        { id: 'vacinas-6m', titulo: 'Doses de 6 meses' },
        { id: 'vacinas-12m', titulo: 'Doses de 12 meses' },
        { id: 'registrar-doses', titulo: 'Registrar cada dose na Prumo' },
      ],
    },

    {
      id: 'alimentacao',
      titulo: 'Alimentar sem complicar',
      resumo: 'Leite até os 6 meses, comida de verdade depois.',
      icone: 'colher',
      explicacaoLeiga:
        'Até os 6 meses, só leite — materno de preferência, e nada mais: nem água, nem chá, nem suco. Depois dos 6 meses entra a comida, e ela deve ser comida de verdade, amassada com o garfo, não papinha industrializada nem liquidificada. O leite continua, agora acompanhando as refeições. É normal o bebê recusar, brincar, cuspir: aceitar um alimento novo pode levar mais de dez tentativas, e isso não é birra.',
      porqueImporta:
        'A relação com a comida se forma agora, e forçar é o caminho mais rápido para uma criança que come mal depois.',
      fonte: 'Ministério da Saúde — Guia Alimentar para Crianças Brasileiras Menores de 2 Anos.',
      janela: { desdeMes: 0, ateMes: 12 },
      lembrete: { antecedenciaDias: 14, canal: 'inapp', repetirDias: 0 },
      passos: [
        { id: 'leite-exclusivo', titulo: 'Leite exclusivo até os 6 meses' },
        { id: 'inicio-comida', titulo: 'Começar a comida aos 6 meses' },
        {
          id: 'sem-acucar',
          titulo: 'Nada de açúcar antes dos 2 anos',
          explicacaoLeiga:
            'Vale para o açúcar visível e para o escondido: biscoito, iogurte adoçado, achocolatado. Não é rigidez — é que o paladar dele está sendo formado agora.',
        },
        { id: 'evitar-ultraprocessados', titulo: 'Evitar ultraprocessados' },
      ],
    },

    {
      id: 'marcos',
      titulo: 'Acompanhar o desenvolvimento',
      resumo: 'Os marcos, sem transformar em corrida.',
      icone: 'estrela',
      explicacaoLeiga:
        'Sorrir, sustentar a cabeça, sentar, engatinhar, falar as primeiras palavras — cada bebê chega nesses marcos no seu tempo, e a variação normal é grande. O que o pediatra observa não é a data exata: é se a sequência está acontecendo. Comparar com o filho de outra pessoa não ajuda ninguém; o que ajuda é contar ao pediatra o que você percebe.',
      porqueImporta:
        'Quando existe um atraso de verdade, quem percebe primeiro quase sempre é quem convive — e cedo é quando a estimulação funciona melhor.',
      fonte: 'Ministério da Saúde — Caderneta da Criança, marcos do desenvolvimento.',
      janela: { desdeMes: 0, ateMes: 12 },
      lembrete: { antecedenciaDias: 0, canal: 'inapp', repetirDias: 30 },
      passos: [
        { id: 'observar-marcos', titulo: 'Ver os marcos da idade dele aqui na Prumo' },
        {
          id: 'anotar-duvidas',
          titulo: 'Anotar no caderninho o que te chamou atenção',
          explicacaoLeiga: 'Leve na consulta. O que você viu em casa vale muito para o pediatra.',
        },
        {
          id: 'conversar-atraso',
          titulo: 'Falar se algo parece diferente',
          explicacaoLeiga:
            'Não espere a próxima consulta se você está preocupada. Perguntar cedo nunca é exagero.',
        },
      ],
    },

    {
      id: 'seguranca-bebe',
      titulo: 'Deixar a casa segura',
      resumo: 'Sono seguro, carro e a casa por volta dos 6 meses.',
      icone: 'escudo',
      explicacaoLeiga:
        'Três coisas resolvem a maior parte dos acidentes graves no primeiro ano. Sono seguro: de barriga para cima, no berço dele, sem travesseiro, sem protetor de berço e sem cobertor solto. Carro: sempre na cadeirinha, virada para trás o máximo de tempo possível — nunca no colo, nem para a esquina. E, por volta dos 6 meses, quando ele começa a se mover, a casa muda: tomadas, escadas, produtos de limpeza, objetos pequenos.',
      porqueImporta:
        'São mudanças simples que previnem exatamente os acidentes que mais acontecem nessa idade.',
      fonte: 'Sociedade Brasileira de Pediatria — sono seguro e prevenção de acidentes.',
      janela: { desdeMes: 0, ateMes: 12 },
      lembrete: { antecedenciaDias: 0, canal: 'inapp', repetirDias: 0 },
      passos: [
        { id: 'sono-seguro', titulo: 'Sono seguro: de barriga para cima, no berço' },
        { id: 'cadeirinha', titulo: 'Cadeirinha em todo trajeto, virada para trás' },
        { id: 'casa-segura', titulo: 'Revisar a casa quando ele começar a se mexer' },
        {
          id: 'sem-fumo',
          titulo: 'Ninguém fuma perto dele',
          explicacaoLeiga: 'Nem na varanda com a porta aberta — a fumaça entra e fica na roupa.',
        },
      ],
    },
  ],
}
