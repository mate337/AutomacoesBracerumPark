import type { AutomationContent } from "./types";

const PUBLIC_PT = [
  "Enviado por mensagem. Qualquer dúvida, é só responder por lá.",
  "Enviamos por mensagem, {usuario}. Seguimos à disposição por lá.",
  "Material enviado no Direct. Qualquer dúvida, é só responder a mensagem.",
];
const PUBLIC_ES = [
  "Enviado por mensaje. Cualquier consulta, puede responder por allí.",
  "Le enviamos el material por mensaje, {usuario}. Quedamos a disposición.",
  "Material enviado por Direct. Cualquier consulta, responda el mensaje.",
];

type Template = {
  key: string;
  name: string;
  keywords: string[];
  summary: string;
  content: AutomationContent;
};

function build(
  material: { pt: string; es: string },
  button: { pt: string; es: string },
  delivery: { pt: string; es: string },
): AutomationContent {
  return {
    pt: {
      publicReplies: PUBLIC_PT,
      opening: {
        text: `Olá, {nome}. Obrigado pelo interesse no Bracerum Park. Toque no botão abaixo para receber ${material.pt} em PDF.`,
        button: button.pt,
      },
      delivery: { text: delivery.pt },
    },
    es: {
      publicReplies: PUBLIC_ES,
      opening: {
        text: `Hola, {nome}. Gracias por su interés en Bracerum Park. Toque el botón de abajo para recibir ${material.es} en PDF.`,
        button: button.es,
      },
      delivery: { text: delivery.es },
    },
  };
}

/** Modelos iniciais, a partir dos cinco guias por mensagem aprovados. */
export const TEMPLATES: Template[] = [
  {
    key: "mapa",
    name: "Mapa logístico",
    keywords: ["MAPA"],
    summary: "Terminais de Villeta, distâncias até o Brasil e operação de carga no parque.",
    content: build(
      { pt: "o mapa logístico", es: "el mapa logístico" },
      { pt: "Receber o mapa", es: "Recibir el mapa" },
      {
        pt: "Olá, {nome}. Aqui está o mapa logístico do Bracerum Park: os terminais de Villeta, as distâncias rodoviárias até o Brasil e a operação de carga dentro do parque.\n{link}\nSe quiser, calculamos a rota do seu produto. Qual é o volume mensal que você movimenta hoje?",
        es: "Hola, {nome}. Aquí está el mapa logístico de Bracerum Park: los terminales de Villeta, las distancias por ruta hasta Brasil y la operación de carga dentro del parque.\n{link}\nSi lo desea, calculamos la ruta de su producto. ¿Cuál es el volumen mensual que mueve hoy?",
      },
    ),
  },
  {
    key: "boletim",
    name: "Checklist do contrato de energia",
    keywords: ["BOLETIM"],
    summary: "As cinco perguntas para o contrato de energia no Paraguai.",
    content: build(
      { pt: "o checklist do contrato de energia", es: "el checklist del contrato de energía" },
      { pt: "Receber o checklist", es: "Recibir checklist" },
      {
        pt: "Olá, {nome}. Aqui está o checklist das cinco perguntas para o contrato de energia no Paraguai, com o caso público de 2026 em ordem.\n{link}\nPara receber o Boletim Paraguai toda semana, é só responder com o seu e-mail.",
        es: "Hola, {nome}. Aquí está el checklist de las cinco preguntas para el contrato de energía en Paraguay, con el caso público de 2026 en orden.\n{link}\nPara recibir el Boletín Paraguay cada semana, responda con su correo electrónico.",
      },
    ),
  },
  {
    key: "terra",
    name: "Garantias do investidor",
    keywords: ["TERRA"],
    summary: "Garantias ao investidor estrangeiro, faixa de fronteira e diligência do terreno.",
    content: build(
      { pt: "o resumo das garantias do investidor", es: "el resumen de garantías al inversor" },
      { pt: "Receber o resumo", es: "Recibir el resumen" },
      {
        pt: "Olá, {nome}. Aqui está o resumo das garantias do investidor estrangeiro no Paraguai, com a regra da faixa de fronteira e um checklist de diligência do terreno.\n{link}\nSe quiser conversar com o jurídico do Park, me diga qual é o seu produto e se pretende comprar ou locar.",
        es: "Hola, {nome}. Aquí está el resumen de las garantías al inversor extranjero en Paraguay, con la regla de la franja de frontera y un checklist de diligencia del terreno.\n{link}\nSi desea hablar con el área jurídica del Park, cuénteme cuál es su producto y si pretende comprar o alquilar.",
      },
    ),
  },
  {
    key: "residencia",
    name: "Investor Pass",
    keywords: ["RESIDÊNCIA"],
    summary: "Passo a passo do Investor Pass: categorias, documentos, órgãos e prazos.",
    content: build(
      { pt: "o passo a passo do Investor Pass", es: "el paso a paso del Investor Pass" },
      { pt: "Receber o guia", es: "Recibir la guía" },
      {
        pt: "Olá, {nome}. Aqui está o passo a passo do Investor Pass: categorias, documentos, órgãos e prazos.\n{link}\nQual categoria faz mais sentido para você hoje: produtiva, imobiliária ou financeira?",
        es: "Hola, {nome}. Aquí está el paso a paso del Investor Pass: categorías, documentos, organismos y plazos.\n{link}\n¿Qué categoría tiene más sentido para usted hoy: productiva, inmobiliaria o financiera?",
      },
    ),
  },
  {
    key: "resort",
    name: "Bracerum Resort",
    keywords: ["RESORT"],
    summary: "Apresentação do Bracerum Resort com a planta da casa-tipo.",
    content: build(
      { pt: "a apresentação do Bracerum Resort", es: "la presentación de Bracerum Resort" },
      { pt: "Receber o material", es: "Recibir presentación" },
      {
        pt: "Olá, {nome}. Aqui está a apresentação do Bracerum Resort, com a planta da casa-tipo de 254,40 m².\n{link}\nQuer agendar uma apresentação por vídeo ou uma visita ao terreno?",
        es: "Hola, {nome}. Aquí está la presentación de Bracerum Resort, con la planta de la casa tipo de 254,40 m².\n{link}\n¿Desea agendar una presentación por video o una visita al terreno?",
      },
    ),
  },
];

export const BLANK_CONTENT: AutomationContent = build(
  { pt: "o material", es: "el material" },
  { pt: "Receber o material", es: "Recibir el material" },
  {
    pt: "Olá, {nome}. Aqui está o material do Bracerum Park.\n{link}\nSe desejar, nossa equipe apresenta o parque em detalhe. Qual é o segmento da sua empresa?",
    es: "Hola, {nome}. Aquí está el material de Bracerum Park.\n{link}\nSi lo desea, nuestro equipo le presenta el parque en detalle. ¿Cuál es el rubro de su empresa?",
  },
);
