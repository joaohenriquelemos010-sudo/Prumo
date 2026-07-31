/**
 * O checklist da gestante, em português de gente.
 *
 * Deriva das mesmas fontes que o roteiro clínico (`src/features/clinico/*`):
 * Caderneta da Gestante e protocolo de pré-natal de risco habitual do Ministério
 * da Saúde, calendário do PNI, e diretrizes da FEBRASGO. Mas **não é uma
 * tradução** — é reescrita.
 *
 * A régua de cada texto: uma mulher de 24 anos, sem formação em saúde, lendo no
 * celular às onze da noite, precisa entender o que fazer, por que importa, e
 * sair menos ansiosa do que entrou. Onde a diretriz diz "rastreio de EGB entre
 * 35 e 37 semanas", aqui diz que é um cotonete rápido e sem dor.
 *
 * Três regras que valem para todo texto aqui:
 *  1. Nunca alarmar sem dar o próximo passo junto.
 *  2. Nunca prometer resultado ("vai dar tudo certo") — dizer o que o exame faz.
 *  3. Nunca substituir a médica: o checklist lembra e explica, não prescreve.
 */

import type { TemplateSemente } from './tipos.js'

export const gestanteCompleto: TemplateSemente = {
  chave: 'gestante-completo',
  versao: 1,
  programa: 'materno-infantil',
  publico: 'gestante',
  fase: 'gestacao',
  titulo: 'Sua gravidez, passo a passo',
  descricao:
    'O que fazer em cada fase, por que importa, e como é na prática. Vá no seu ritmo — nada aqui é prova.',
  icone: 'coracao',

  grupos: [
    {
      id: 'comecar-prenatal',
      titulo: 'Começar o pré-natal',
      resumo: 'A primeira consulta e o cartão da gestante.',
      icone: 'estetoscopio',
      explicacaoLeiga:
        'O pré-natal é o acompanhamento da sua gravidez do começo ao fim. Quanto mais cedo começa, mais tempo a equipe tem para cuidar de qualquer coisa com calma, em vez de correndo. Na primeira consulta a médica vai querer saber da sua saúde, das gestações anteriores se houver, e vai pedir os primeiros exames. Leve seus documentos e, se tiver, a caderneta de vacinação.',
      porqueImporta:
        'Começar no primeiro trimestre é o que mais muda o resultado de uma gestação — mais até do que quantas consultas você faz depois.',
      fonte: 'Ministério da Saúde — Caderneta da Gestante e protocolo de pré-natal de risco habitual.',
      janela: { desdeSemana: 0, ateSemana: 13 },
      lembrete: { antecedenciaDias: 0, canal: 'inapp', repetirDias: 7 },
      passos: [
        {
          id: 'marcar-primeira',
          titulo: 'Marcar a primeira consulta',
          explicacaoLeiga:
            'Pode ser na unidade de saúde perto de casa ou com a obstetra que você escolher. Não precisa esperar nenhum resultado para marcar.',
        },
        {
          id: 'levar-documentos',
          titulo: 'Separar documentos e carteira de vacinação',
          dica: 'RG, CPF, cartão do SUS ou do convênio, e a caderneta de vacinas se você encontrar.',
        },
        {
          id: 'contar-historia',
          titulo: 'Anotar o que contar para a médica',
          explicacaoLeiga:
            'Data da última menstruação, remédios que você toma, alergias, doenças na família, gestações anteriores. Anote antes — na hora a gente esquece.',
        },
        {
          id: 'receber-cartao',
          titulo: 'Receber o cartão (ou caderneta) da gestante',
          explicacaoLeiga:
            'É onde tudo do pré-natal fica registrado. Leve em toda consulta e leve também se precisar ir ao pronto-socorro.',
        },
      ],
    },

    {
      id: 'exames-primeiro-trimestre',
      titulo: 'Fazer os exames do primeiro trimestre',
      resumo: 'Uma coleta só, no começo da gestação.',
      icone: 'tubo',
      explicacaoLeiga:
        'São exames de sangue e de urina que sua médica pede logo no começo. Eles mostram como seu corpo está e se tem alguma coisa que precisa de atenção antes de a gravidez avançar — anemia, diabetes, infecção urinária, algumas infecções que têm tratamento simples quando descobertas cedo. É uma coleta só: você faz tudo de uma vez.',
      porqueImporta:
        'Quase tudo que esses exames encontram tem tratamento, e o tratamento funciona muito melhor no começo.',
      fonte: 'Ministério da Saúde — Caderneta da Gestante; rotina laboratorial do pré-natal.',
      janela: { desdeSemana: 0, ateSemana: 14 },
      lembrete: { antecedenciaDias: 3, canal: 'inapp', repetirDias: 7 },
      passos: [
        { id: 'pegar-pedido', titulo: 'Pegar o pedido com a sua médica' },
        {
          id: 'conferir-jejum',
          titulo: 'Ver se precisa de jejum',
          explicacaoLeiga:
            'Costuma ser 8 horas por causa da glicemia. Água pode. Marque de manhã cedo — assim você dorme boa parte do jejum.',
        },
        {
          id: 'ir-laboratorio',
          titulo: 'Ir ao laboratório',
          dica: 'Se enjoar em jejum, leve algo para comer logo depois da coleta.',
        },
        {
          id: 'guardar-resultado',
          titulo: 'Guardar o resultado aqui na Prumo',
          explicacaoLeiga:
            'Assim sua médica vê antes mesmo da consulta, e você não precisa carregar papel.',
        },
        { id: 'levar-consulta', titulo: 'Levar na próxima consulta' },
      ],
    },

    {
      id: 'ultrassom-inicial',
      titulo: 'Fazer o primeiro ultrassom',
      resumo: 'Confirma o tempo de gestação e a data provável do parto.',
      icone: 'onda',
      explicacaoLeiga:
        'O ultrassom do começo serve principalmente para uma coisa: acertar de quantas semanas você está. Essa data vira a referência de tudo depois — quando fazer cada exame, quando esperar o bebê. É rápido, não dói, e no começo costuma ser feito por dentro (transvaginal), que é o que enxerga melhor nessa fase.',
      porqueImporta:
        'Um ultrassom precoce dá a idade gestacional mais confiável que existe. Feito tarde, a margem de erro cresce muito.',
      fonte: 'FEBRASGO e Ministério da Saúde — ultrassonografia obstétrica de primeiro trimestre.',
      janela: { desdeSemana: 6, ateSemana: 14 },
      lembrete: { antecedenciaDias: 5, canal: 'inapp', repetirDias: 0 },
      passos: [
        { id: 'agendar-usg1', titulo: 'Agendar o exame' },
        {
          id: 'bexiga-cheia',
          titulo: 'Conferir o preparo',
          dica: 'Alguns pedem bexiga cheia; o transvaginal, não. O laboratório informa quando você marca.',
        },
        { id: 'guardar-usg1', titulo: 'Guardar o laudo na Prumo' },
      ],
    },

    {
      id: 'suplementos',
      titulo: 'Tomar os suplementos todos os dias',
      resumo: 'Ácido fólico e ferro, conforme a orientação.',
      icone: 'comprimido',
      explicacaoLeiga:
        'O ácido fólico protege a formação do sistema nervoso do bebê nas primeiras semanas — por isso ele começa cedo, de preferência antes mesmo de engravidar. O ferro previne anemia, que é comum na gravidez e deixa você muito cansada. Não são vitaminas "de reforço": têm hora e dose, e quem define é a sua médica.',
      porqueImporta:
        'É das coisas mais simples que você faz na gestação e das que mais têm efeito comprovado.',
      fonte: 'Ministério da Saúde — programas nacionais de suplementação na gestação.',
      janela: { desdeSemana: 0, ateSemana: 42 },
      lembrete: { antecedenciaDias: 0, canal: 'inapp', repetirDias: 30 },
      passos: [
        { id: 'receita-suplemento', titulo: 'Pegar a receita' },
        {
          id: 'rotina-suplemento',
          titulo: 'Criar uma rotina para não esquecer',
          explicacaoLeiga:
            'Deixe o vidro junto da escova de dente, ou marque um horário no celular. O ferro absorve melhor longe do café, do leite e do chá.',
        },
        {
          id: 'efeitos-ferro',
          titulo: 'Saber o que é normal com o ferro',
          explicacaoLeiga:
            'Fezes escuras são esperadas e não são sangramento. Se der muita prisão de ventre ou enjoo, fale com a médica — dá para trocar a apresentação.',
          opcional: true,
        },
      ],
    },

    {
      id: 'vacinas-gestacao',
      titulo: 'Tomar as vacinas da gravidez',
      resumo: 'dTpa, gripe e hepatite B, conforme sua situação.',
      icone: 'seringa',
      explicacaoLeiga:
        'As vacinas da gestação protegem duas pessoas. A dTpa, tomada a partir da 20ª semana, faz seu corpo produzir defesas contra a coqueluche que atravessam para o bebê — e o protegem nos primeiros meses, antes de ele poder se vacinar. A da gripe protege você, que na gravidez tem mais risco de complicação. Todas são seguras na gestação; as que não são simplesmente não entram nesta lista.',
      porqueImporta:
        'A coqueluche é grave em recém-nascido, e a única proteção possível nos primeiros dois meses de vida é a que vem de você.',
      fonte: 'Ministério da Saúde — Programa Nacional de Imunizações (PNI), calendário da gestante.',
      janela: { desdeSemana: 20, ateSemana: 42 },
      lembrete: { antecedenciaDias: 7, canal: 'inapp', repetirDias: 14 },
      passos: [
        {
          id: 'conferir-caderneta',
          titulo: 'Conferir sua caderneta de vacinação',
          explicacaoLeiga: 'Se você não achar, a unidade de saúde consegue consultar o histórico.',
        },
        { id: 'dtpa', titulo: 'Tomar a dTpa (a partir de 20 semanas)' },
        { id: 'gripe', titulo: 'Tomar a vacina da gripe (na campanha)' },
        { id: 'hepatite-b', titulo: 'Completar hepatite B, se faltar dose', opcional: true },
        { id: 'registrar-vacinas', titulo: 'Registrar as doses na Prumo' },
      ],
    },

    {
      id: 'morfologico',
      titulo: 'Fazer o ultrassom morfológico',
      resumo: 'O exame que olha a formação do bebê com detalhe.',
      icone: 'onda',
      explicacaoLeiga:
        'É o ultrassom mais detalhado da gestação. O médico olha órgão por órgão — coração, cérebro, rins, coluna, mãos e pés — para ver se está tudo se formando como esperado. Costuma demorar mais que os outros e às vezes pedem para você andar um pouco ou comer algo, porque o bebê precisa mudar de posição. É um exame demorado por ser cuidadoso, não porque achou algo.',
      porqueImporta:
        'A grande maioria das mães sai daqui tranquila. E quando algo aparece, descobrir agora é o que dá tempo de planejar o parto no lugar certo, com a equipe certa.',
      fonte: 'FEBRASGO — ultrassonografia morfológica de segundo trimestre.',
      janela: { desdeSemana: 20, ateSemana: 24 },
      lembrete: { antecedenciaDias: 10, canal: 'inapp', repetirDias: 7 },
      passos: [
        {
          id: 'agendar-morfo',
          titulo: 'Agendar entre 20 e 24 semanas',
          explicacaoLeiga:
            'Essa janela não é burocracia: antes o bebê é pequeno demais para ver bem, depois ele fica apertado e esconde partes.',
        },
        { id: 'reservar-tempo', titulo: 'Reservar tempo — pode passar de 40 minutos' },
        { id: 'guardar-morfo', titulo: 'Guardar o laudo na Prumo' },
      ],
    },

    {
      id: 'diabetes-gestacional',
      titulo: 'Fazer o exame de diabetes gestacional',
      resumo: 'A curva glicêmica, entre 24 e 28 semanas.',
      icone: 'tubo',
      explicacaoLeiga:
        'Na gravidez o corpo naturalmente lida pior com o açúcar, e em algumas mulheres isso passa do ponto. O exame é uma manhã: coleta em jejum, você toma um líquido bem doce, e coleta de novo depois de 1 e 2 horas. É chato — o líquido enjoa e você fica ali esperando — mas é uma manhã só.',
      porqueImporta:
        'Diabetes gestacional quase nunca dá sintoma. Descoberto, controla-se na maioria das vezes só com alimentação; ignorado, faz o bebê crescer demais e complica o parto.',
      fonte: 'Ministério da Saúde e FEBRASGO — TOTG 75 g entre 24 e 28 semanas.',
      janela: { desdeSemana: 24, ateSemana: 28 },
      lembrete: { antecedenciaDias: 7, canal: 'inapp', repetirDias: 7 },
      passos: [
        { id: 'agendar-totg', titulo: 'Agendar entre 24 e 28 semanas' },
        {
          id: 'preparo-totg',
          titulo: 'Fazer o jejum certo',
          explicacaoLeiga:
            '8 horas, e nos dias antes coma normalmente — cortar carboidrato antes do exame atrapalha o resultado em vez de ajudar.',
        },
        {
          id: 'levar-companhia',
          titulo: 'Levar companhia e algo para fazer',
          dica: 'São cerca de 2 horas no laboratório, e você não pode sair no meio.',
          opcional: true,
        },
        { id: 'guardar-totg', titulo: 'Guardar o resultado na Prumo' },
      ],
    },

    {
      id: 'sinais-de-alerta',
      titulo: 'Saber quando procurar ajuda na hora',
      resumo: 'Os sinais que não esperam a próxima consulta.',
      icone: 'alerta',
      explicacaoLeiga:
        'A maior parte dos desconfortos da gravidez é normal e passa. Mas alguns sinais pedem avaliação no mesmo dia, sem esperar consulta marcada: sangramento pela vagina, perda de líquido, dor de cabeça forte que não passa com analgésico, enxergar pontos brilhantes ou embaçado, inchaço súbito no rosto e nas mãos, febre, dor forte na barriga, ou o bebê parar de mexer como costuma. Procurar e não ser nada é o resultado desejado — ninguém vai achar exagero.',
      porqueImporta:
        'Quase tudo nessa lista tem solução quando visto cedo. O que custa caro é esperar para ver se melhora.',
      fonte: 'Ministério da Saúde — sinais de alerta na gestação, Caderneta da Gestante.',
      janela: { desdeSemana: 0, ateSemana: 42 },
      lembrete: { antecedenciaDias: 0, canal: 'inapp', repetirDias: 0 },
      passos: [
        { id: 'ler-sinais', titulo: 'Ler a lista com calma, uma vez' },
        {
          id: 'salvar-contato',
          titulo: 'Salvar o telefone da maternidade no celular',
          explicacaoLeiga: 'Na hora do susto ninguém procura número. Deixe salvo hoje.',
        },
        {
          id: 'combinar-transporte',
          titulo: 'Combinar como você chegaria lá de madrugada',
          dica: 'Quem leva, com que carro, quem fica com os outros filhos.',
        },
        {
          id: 'contar-movimento',
          titulo: 'Aprender a sentir o padrão do bebê',
          explicacaoLeiga:
            'A partir do fim do segundo trimestre, repare no ritmo dele em algum momento do dia. O que importa não é um número: é você conhecer o que é normal para o SEU bebê e perceber quando mudou.',
        },
      ],
    },

    {
      id: 'exames-terceiro-trimestre',
      titulo: 'Fazer os exames da reta final',
      resumo: 'Repetições e o cotonete do estreptococo.',
      icone: 'tubo',
      explicacaoLeiga:
        'Na reta final alguns exames são repetidos, porque muita coisa muda em nove meses e o que importa agora é como você está chegando no parto. Entra também um exame novo, entre 35 e 37 semanas: um cotonete passado na vagina e no ânus, rápido e sem dor, para procurar uma bactéria chamada estreptococo do grupo B. Ela é comum e não faz mal a você — mas se estiver lá, você recebe antibiótico na veia durante o trabalho de parto, e isso protege o bebê.',
      porqueImporta:
        'Saber do estreptococo antes é o que permite tratar na hora certa. Descobrir depois do parto é tarde.',
      fonte: 'Ministério da Saúde e FEBRASGO — rotina de terceiro trimestre e rastreio de EGB (35–37 semanas).',
      janela: { desdeSemana: 28, ateSemana: 40 },
      lembrete: { antecedenciaDias: 7, canal: 'inapp', repetirDias: 7 },
      passos: [
        { id: 'pedido-3tri', titulo: 'Pegar o pedido dos exames' },
        { id: 'coleta-3tri', titulo: 'Fazer a coleta de sangue e urina' },
        {
          id: 'egb',
          titulo: 'Fazer o cotonete do estreptococo (35 a 37 semanas)',
          explicacaoLeiga:
            'Dura segundos. Em muitos lugares você mesma pode coletar, com a enfermeira explicando.',
        },
        { id: 'guardar-3tri', titulo: 'Guardar os resultados na Prumo' },
      ],
    },

    {
      id: 'preparar-parto',
      titulo: 'Preparar a chegada',
      resumo: 'Mala, plano de parto e o caminho até a maternidade.',
      icone: 'mala',
      explicacaoLeiga:
        'Não é para deixar tudo pronto de véspera — é para não precisar decidir nada correndo. A mala arrumada por volta das 36 semanas, a maternidade definida, o caminho conhecido, e uma conversa com a médica sobre o que você quer e o que ela recomenda. Plano de parto não é contrato: é você dizendo o que importa para você, e a equipe explicando o que dá para garantir.',
      porqueImporta:
        'Chegar sabendo para onde ir e com o que já separado é o que sobra de energia para o que interessa.',
      fonte: 'Ministério da Saúde — orientações para o parto e nascimento.',
      janela: { desdeSemana: 32, ateSemana: 40 },
      lembrete: { antecedenciaDias: 14, canal: 'inapp', repetirDias: 14 },
      passos: [
        {
          id: 'definir-maternidade',
          titulo: 'Confirmar em qual maternidade você vai parir',
          explicacaoLeiga:
            'E confirme que eles têm o seu cadastro. Fazer isso agora evita descobrir em trabalho de parto que a referência é outra.',
        },
        { id: 'arrumar-mala', titulo: 'Arrumar a mala (sua e do bebê)' },
        {
          id: 'plano-parto',
          titulo: 'Conversar sobre o plano de parto',
          explicacaoLeiga:
            'Quem você quer do lado, o que você prefere sobre alívio da dor, o que fazer se precisar mudar o plano. Escreva e leve uma cópia.',
        },
        { id: 'documentos-parto', titulo: 'Separar documentos e o cartão da gestante' },
        {
          id: 'testar-caminho',
          titulo: 'Fazer o caminho até a maternidade uma vez',
          dica: 'De preferência no horário em que o trânsito é pior.',
          opcional: true,
        },
      ],
    },

    {
      id: 'amamentacao',
      titulo: 'Se preparar para amamentar',
      resumo: 'O que saber antes, para não aprender no susto.',
      icone: 'gota',
      explicacaoLeiga:
        'Amamentar é natural, mas não é automático — e quase ninguém avisa isso. Os primeiros dias costumam ser os mais difíceis: o leite demora a "descer", a pega dói se não estiver certa, e o bebê mama muitas vezes. Saber disso antes muda tudo, porque você reconhece o que é esperado em vez de achar que está falhando. E saber onde pedir ajuda no dia 3 vale mais que qualquer preparo.',
      porqueImporta:
        'A maioria das desistências acontece na primeira semana, por dificuldades que têm solução simples quando alguém olha.',
      fonte: 'Ministério da Saúde — Caderneta da Gestante, aleitamento materno.',
      janela: { desdeSemana: 28, ateSemana: 42 },
      lembrete: { antecedenciaDias: 14, canal: 'inapp', repetirDias: 0 },
      passos: [
        { id: 'ler-amamentacao', titulo: 'Ler o conteúdo de amamentação aqui na Prumo' },
        {
          id: 'onde-ajuda',
          titulo: 'Descobrir onde tem ajuda perto de você',
          explicacaoLeiga:
            'Banco de leite, consultora de amamentação, a própria unidade de saúde. Anote o contato antes de precisar.',
        },
        {
          id: 'conversar-pega',
          titulo: 'Conversar sobre a pega com sua equipe',
          explicacaoLeiga:
            'Dor forte quase sempre é sinal de pega errada, não de "peito sensível". Isso se corrige com alguém olhando.',
        },
        { id: 'combinar-apoio', titulo: 'Combinar quem vai te ajudar nos primeiros dias', opcional: true },
      ],
    },

    {
      id: 'pos-parto',
      titulo: 'Cuidar de você depois do parto',
      resumo: 'A consulta do puerpério e os sinais de atenção.',
      icone: 'coracao',
      explicacaoLeiga:
        'Depois que o bebê nasce, todo mundo olha para ele — e você também precisa de consulta. Ela acontece por volta de 7 a 10 dias e de novo até 42 dias, e serve para ver como você está: sangramento, cicatriz, amamentação, e como você está se sentindo por dentro. Tristeza nos primeiros dias é comum e costuma passar. Tristeza que não passa, que tira o sono ou o apetite, ou pensamentos que te assustam, não é fraqueza e tem tratamento — conte para alguém da equipe.',
      porqueImporta:
        'O puerpério é o período mais negligenciado da gestação inteira, e é quando várias coisas sérias aparecem.',
      fonte: 'Ministério da Saúde — atenção ao puerpério e saúde mental materna.',
      janela: { desdeSemana: 38, ateSemana: 42 },
      lembrete: { antecedenciaDias: 0, canal: 'inapp', repetirDias: 7 },
      passos: [
        { id: 'consulta-puerperio', titulo: 'Marcar a consulta do puerpério' },
        { id: 'teste-pezinho', titulo: 'Fazer o teste do pezinho do bebê (3º ao 5º dia)' },
        {
          id: 'sinais-puerperio',
          titulo: 'Conhecer os sinais que pedem ajuda',
          explicacaoLeiga:
            'Febre, sangramento que aumenta em vez de diminuir, dor ou vermelhidão na cicatriz, dor forte na perna, ou dor de cabeça forte. Qualquer um desses: procure atendimento.',
        },
        {
          id: 'falar-sentimento',
          titulo: 'Falar com alguém sobre como você está se sentindo',
          explicacaoLeiga:
            'Com a equipe, com quem você confia. Pedir ajuda no puerpério é cuidado, não fraqueza.',
        },
      ],
    },
  ],
}
