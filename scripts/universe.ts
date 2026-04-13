export interface TickerEntry {
  ticker: string
  expectedName: string
  indices: string[]
}

// ─── CAC 40 (40 values) ───
const CAC40: TickerEntry[] = [
  { ticker: "AC.PA", expectedName: "Accor", indices: ["CAC 40"] },
  { ticker: "AI.PA", expectedName: "Air Liquide", indices: ["CAC 40"] },
  { ticker: "AIR.PA", expectedName: "Airbus", indices: ["CAC 40"] },
  { ticker: "ALO.PA", expectedName: "Alstom", indices: ["CAC 40"] },
  { ticker: "MT.PA", expectedName: "ArcelorMittal", indices: ["CAC 40"] },
  { ticker: "CS.PA", expectedName: "AXA", indices: ["CAC 40"] },
  { ticker: "BNP.PA", expectedName: "BNP Paribas", indices: ["CAC 40"] },
  { ticker: "EN.PA", expectedName: "Bouygues", indices: ["CAC 40"] },
  { ticker: "CAP.PA", expectedName: "Capgemini", indices: ["CAC 40"] },
  { ticker: "CA.PA", expectedName: "Carrefour", indices: ["CAC 40"] },
  { ticker: "ACA.PA", expectedName: "Crédit Agricole", indices: ["CAC 40"] },
  { ticker: "BN.PA", expectedName: "Danone", indices: ["CAC 40"] },
  { ticker: "DSY.PA", expectedName: "Dassault Systèmes", indices: ["CAC 40"] },
  { ticker: "ENGI.PA", expectedName: "Engie", indices: ["CAC 40"] },
  { ticker: "EL.PA", expectedName: "EssilorLuxottica", indices: ["CAC 40"] },
  { ticker: "ERF.PA", expectedName: "Eurofins Scientific", indices: ["CAC 40"] },
  { ticker: "RMS.PA", expectedName: "Hermès", indices: ["CAC 40"] },
  { ticker: "KER.PA", expectedName: "Kering", indices: ["CAC 40"] },
  { ticker: "LR.PA", expectedName: "Legrand", indices: ["CAC 40"] },
  { ticker: "OR.PA", expectedName: "L'Oréal", indices: ["CAC 40"] },
  { ticker: "MC.PA", expectedName: "LVMH", indices: ["CAC 40"] },
  { ticker: "ML.PA", expectedName: "Michelin", indices: ["CAC 40"] },
  { ticker: "ORA.PA", expectedName: "Orange", indices: ["CAC 40"] },
  { ticker: "RI.PA", expectedName: "Pernod Ricard", indices: ["CAC 40"] },
  { ticker: "PUB.PA", expectedName: "Publicis", indices: ["CAC 40"] },
  { ticker: "RNO.PA", expectedName: "Renault", indices: ["CAC 40"] },
  { ticker: "SAF.PA", expectedName: "Safran", indices: ["CAC 40"] },
  { ticker: "SGO.PA", expectedName: "Saint-Gobain", indices: ["CAC 40"] },
  { ticker: "SAN.PA", expectedName: "Sanofi", indices: ["CAC 40"] },
  { ticker: "SU.PA", expectedName: "Schneider Electric", indices: ["CAC 40"] },
  { ticker: "GLE.PA", expectedName: "Société Générale", indices: ["CAC 40"] },
  { ticker: "STLAP.PA", expectedName: "Stellantis", indices: ["CAC 40"] },
  { ticker: "STMPA.PA", expectedName: "STMicroelectronics", indices: ["CAC 40"] },
  { ticker: "TEP.PA", expectedName: "Teleperformance", indices: ["CAC 40"] },
  { ticker: "HO.PA", expectedName: "Thales", indices: ["CAC 40"] },
  { ticker: "TTE.PA", expectedName: "TotalEnergies", indices: ["CAC 40"] },
  { ticker: "URW.PA", expectedName: "Unibail-Rodamco", indices: ["CAC 40"] },
  { ticker: "VIE.PA", expectedName: "Veolia", indices: ["CAC 40"] },
  { ticker: "DG.PA", expectedName: "Vinci", indices: ["CAC 40"] },
  { ticker: "VIV.PA", expectedName: "Vivendi", indices: ["CAC 40"] },
]

// ─── CAC Next 20 (20 values) ───
const CAC_NEXT20: TickerEntry[] = [
  { ticker: "AF.PA", expectedName: "Air France-KLM", indices: ["CAC Next 20"] },
  { ticker: "ATO.PA", expectedName: "Atos", indices: ["CAC Next 20"] },
  { ticker: "BIM.PA", expectedName: "bioMérieux", indices: ["CAC Next 20"] },
  { ticker: "BOL.PA", expectedName: "Bolloré", indices: ["CAC Next 20"] },
  { ticker: "AM.PA", expectedName: "Dassault Aviation", indices: ["CAC Next 20"] },
  { ticker: "EDEN.PA", expectedName: "Edenred", indices: ["CAC Next 20"] },
  { ticker: "FGR.PA", expectedName: "Eiffage", indices: ["CAC Next 20"] },
  { ticker: "ERA.PA", expectedName: "Eramet", indices: ["CAC Next 20"] },
  { ticker: "FNAC.PA", expectedName: "Fnac Darty", indices: ["CAC Next 20"] },
  { ticker: "GET.PA", expectedName: "Getlink", indices: ["CAC Next 20"] },
  { ticker: "GTT.PA", expectedName: "GTT", indices: ["CAC Next 20"] },
  { ticker: "NK.PA", expectedName: "Imerys", indices: ["CAC Next 20"] },
  { ticker: "IPS.PA", expectedName: "Ipsos", indices: ["CAC Next 20"] },
  { ticker: "RCO.PA", expectedName: "Rémy Cointreau", indices: ["CAC Next 20"] },
  { ticker: "RXL.PA", expectedName: "Rexel", indices: ["CAC Next 20"] },
  { ticker: "SK.PA", expectedName: "SEB", indices: ["CAC Next 20"] },
  { ticker: "SW.PA", expectedName: "Sodexo", indices: ["CAC Next 20"] },
  { ticker: "SOI.PA", expectedName: "Soitec", indices: ["CAC Next 20"] },
  { ticker: "WLN.PA", expectedName: "Worldline", indices: ["CAC Next 20"] },
]

// ─── CAC Mid 60 (selection of most liquid) ───
const CAC_MID60: TickerEntry[] = [
  { ticker: "AKE.PA", expectedName: "Arkema", indices: ["CAC Mid 60"] },
  { ticker: "BVI.PA", expectedName: "Bureau Veritas", indices: ["CAC Mid 60"] },
  { ticker: "CGG.PA", expectedName: "CGG", indices: ["CAC Mid 60"] },
  { ticker: "COV.PA", expectedName: "Covivio", indices: ["CAC Mid 60"] },
  { ticker: "DIM.PA", expectedName: "Sartorius Stedim", indices: ["CAC Mid 60"] },
  { ticker: "EAPI.PA", expectedName: "Euroapi", indices: ["CAC Mid 60"] },
  { ticker: "FDJ.PA", expectedName: "FDJ", indices: ["CAC Mid 60"] },
  { ticker: "FRVIA.PA", expectedName: "Forvia", indices: ["CAC Mid 60"] },
  { ticker: "FTI", expectedName: "TechnipFMC", indices: ["CAC Mid 60"] },
  { ticker: "GFC.PA", expectedName: "Gecina", indices: ["CAC Mid 60"] },
  { ticker: "GBT.PA", expectedName: "Guerbet", indices: ["CAC Mid 60"] },
  { ticker: "IDL.PA", expectedName: "ID Logistics", indices: ["CAC Mid 60"] },
  { ticker: "IPN.PA", expectedName: "Ipsen", indices: ["CAC Mid 60"] },
  { ticker: "KOF.PA", expectedName: "Kaufman & Broad", indices: ["CAC Mid 60"] },
  { ticker: "MMB.PA", expectedName: "Lagardère", indices: ["CAC Mid 60"] },
  { ticker: "LI.PA", expectedName: "Klepierre", indices: ["CAC Mid 60"] },
  { ticker: "MF.PA", expectedName: "Wendel", indices: ["CAC Mid 60"] },
  { ticker: "NEX.PA", expectedName: "Nexans", indices: ["CAC Mid 60"] },
  { ticker: "NXI.PA", expectedName: "Nexity", indices: ["CAC Mid 60"] },
  { ticker: "OPM.PA", expectedName: "OPmobility", indices: ["CAC Mid 60"] },
  { ticker: "OVH.PA", expectedName: "OVHcloud", indices: ["CAC Mid 60"] },
  { ticker: "POM.PA", expectedName: "Plastic Omnium", indices: ["CAC Mid 60"] },
  { ticker: "QDT.PA", expectedName: "Quadient", indices: ["CAC Mid 60"] },
  { ticker: "RUI.PA", expectedName: "Rubis", indices: ["CAC Mid 60"] },
  { ticker: "SCR.PA", expectedName: "Scor", indices: ["CAC Mid 60"] },
  { ticker: "SOP.PA", expectedName: "Sopra Steria", indices: ["CAC Mid 60"] },
  { ticker: "TFI.PA", expectedName: "TF1", indices: ["CAC Mid 60"] },
  { ticker: "TKO.PA", expectedName: "Tikehau Capital", indices: ["CAC Mid 60"] },
  { ticker: "UBI.PA", expectedName: "Ubisoft", indices: ["CAC Mid 60"] },
  { ticker: "VAL.PA", expectedName: "Vallourec", indices: ["CAC Mid 60"] },
  { ticker: "VIRP.PA", expectedName: "Virbac", indices: ["CAC Mid 60"] },
  { ticker: "VLA.PA", expectedName: "Valneva", indices: ["CAC Mid 60"] },
]

// ─── Germany — DAX 40 ───
const DAX40: TickerEntry[] = [
  { ticker: "ADS.DE", expectedName: "Adidas", indices: ["DAX 40"] },
  { ticker: "AIR.DE", expectedName: "Airbus (Xetra)", indices: ["DAX 40"] },
  { ticker: "ALV.DE", expectedName: "Allianz", indices: ["DAX 40"] },
  { ticker: "BAS.DE", expectedName: "BASF", indices: ["DAX 40"] },
  { ticker: "BAYN.DE", expectedName: "Bayer", indices: ["DAX 40"] },
  { ticker: "BEI.DE", expectedName: "Beiersdorf", indices: ["DAX 40"] },
  { ticker: "BMW.DE", expectedName: "BMW", indices: ["DAX 40"] },
  { ticker: "BNR.DE", expectedName: "Brenntag", indices: ["DAX 40"] },
  { ticker: "CON.DE", expectedName: "Continental", indices: ["DAX 40"] },
  { ticker: "1COV.DE", expectedName: "Covestro", indices: ["DAX 40"] },
  { ticker: "DBK.DE", expectedName: "Deutsche Bank", indices: ["DAX 40"] },
  { ticker: "DB1.DE", expectedName: "Deutsche Börse", indices: ["DAX 40"] },
  { ticker: "DHL.DE", expectedName: "DHL Group", indices: ["DAX 40"] },
  { ticker: "DTE.DE", expectedName: "Deutsche Telekom", indices: ["DAX 40"] },
  { ticker: "ENR.DE", expectedName: "Siemens Energy", indices: ["DAX 40"] },
  { ticker: "FRE.DE", expectedName: "Fresenius", indices: ["DAX 40"] },
  { ticker: "HEN3.DE", expectedName: "Henkel", indices: ["DAX 40"] },
  { ticker: "HNR1.DE", expectedName: "Hannover Rück", indices: ["DAX 40"] },
  { ticker: "IFX.DE", expectedName: "Infineon", indices: ["DAX 40"] },
  { ticker: "MBG.DE", expectedName: "Mercedes-Benz", indices: ["DAX 40"] },
  { ticker: "MRK.DE", expectedName: "Merck KGaA", indices: ["DAX 40"] },
  { ticker: "MTX.DE", expectedName: "MTU Aero Engines", indices: ["DAX 40"] },
  { ticker: "MUV2.DE", expectedName: "Munich Re", indices: ["DAX 40"] },
  { ticker: "P911.DE", expectedName: "Porsche AG", indices: ["DAX 40"] },
  { ticker: "PAH3.DE", expectedName: "Porsche Automobil", indices: ["DAX 40"] },
  { ticker: "QIA.DE", expectedName: "Qiagen", indices: ["DAX 40"] },
  { ticker: "RHM.DE", expectedName: "Rheinmetall", indices: ["DAX 40"] },
  { ticker: "RWE.DE", expectedName: "RWE", indices: ["DAX 40"] },
  { ticker: "SAP.DE", expectedName: "SAP", indices: ["DAX 40"] },
  { ticker: "SHL.DE", expectedName: "Siemens Healthineers", indices: ["DAX 40"] },
  { ticker: "SIE.DE", expectedName: "Siemens", indices: ["DAX 40"] },
  { ticker: "SY1.DE", expectedName: "Symrise", indices: ["DAX 40"] },
  { ticker: "VNA.DE", expectedName: "Vonovia", indices: ["DAX 40"] },
  { ticker: "VOW3.DE", expectedName: "Volkswagen", indices: ["DAX 40"] },
  { ticker: "ZAL.DE", expectedName: "Zalando", indices: ["DAX 40"] },
  { ticker: "DHER.DE", expectedName: "Delivery Hero", indices: ["DAX 40"] },
  { ticker: "LEG.DE", expectedName: "LEG Immobilien", indices: ["DAX 40"] },
]

// ─── Netherlands — AEX 25 ───
const AEX25: TickerEntry[] = [
  { ticker: "ADYEN.AS", expectedName: "Adyen", indices: ["AEX 25"] },
  { ticker: "AGN.AS", expectedName: "Aegon", indices: ["AEX 25"] },
  { ticker: "AKZA.AS", expectedName: "Akzo Nobel", indices: ["AEX 25"] },
  { ticker: "ASM.AS", expectedName: "ASM International", indices: ["AEX 25"] },
  { ticker: "ASML.AS", expectedName: "ASML", indices: ["AEX 25"] },
  { ticker: "BESI.AS", expectedName: "BE Semiconductor", indices: ["AEX 25"] },
  { ticker: "HEIA.AS", expectedName: "Heineken", indices: ["AEX 25"] },
  { ticker: "INGA.AS", expectedName: "ING Groep", indices: ["AEX 25"] },
  { ticker: "KPN.AS", expectedName: "KPN", indices: ["AEX 25"] },
  { ticker: "NN.AS", expectedName: "NN Group", indices: ["AEX 25"] },
  { ticker: "PHIA.AS", expectedName: "Philips", indices: ["AEX 25"] },
  { ticker: "PRX.AS", expectedName: "Prosus", indices: ["AEX 25"] },
  { ticker: "RAND.AS", expectedName: "Randstad", indices: ["AEX 25"] },
  { ticker: "UNA.AS", expectedName: "Unilever", indices: ["AEX 25"] },
  { ticker: "WKL.AS", expectedName: "Wolters Kluwer", indices: ["AEX 25"] },
  { ticker: "IMCD.AS", expectedName: "IMCD", indices: ["AEX 25"] },
  { ticker: "SHELL.AS", expectedName: "Shell", indices: ["AEX 25"] },
  { ticker: "ABN.AS", expectedName: "ABN AMRO", indices: ["AEX 25"] },
  { ticker: "AH.AS", expectedName: "Ahold Delhaize", indices: ["AEX 25"] },
  { ticker: "DSFIR.AS", expectedName: "DSM-Firmenich", indices: ["AEX 25"] },
  { ticker: "EXO.AS", expectedName: "Exor", indices: ["AEX 25"] },
  { ticker: "UMG.AS", expectedName: "Universal Music", indices: ["AEX 25"] },
]

// ─── Belgium — BEL 20 ───
const BEL20: TickerEntry[] = [
  { ticker: "ABI.BR", expectedName: "AB InBev", indices: ["BEL 20"] },
  { ticker: "ARGX.BR", expectedName: "argenx", indices: ["BEL 20"] },
  { ticker: "GBLB.BR", expectedName: "GBL", indices: ["BEL 20"] },
  { ticker: "KBC.BR", expectedName: "KBC Group", indices: ["BEL 20"] },
  { ticker: "SOLB.BR", expectedName: "Solvay", indices: ["BEL 20"] },
  { ticker: "UCB.BR", expectedName: "UCB", indices: ["BEL 20"] },
  { ticker: "UMI.BR", expectedName: "Umicore", indices: ["BEL 20"] },
  { ticker: "COFB.BR", expectedName: "Cofinimmo", indices: ["BEL 20"] },
  { ticker: "ACKB.BR", expectedName: "Ackermans & vH", indices: ["BEL 20"] },
  { ticker: "AGS.BR", expectedName: "ageas", indices: ["BEL 20"] },
  { ticker: "PROX.BR", expectedName: "Proximus", indices: ["BEL 20"] },
  { ticker: "WDP.BR", expectedName: "WDP", indices: ["BEL 20"] },
]

// ─── Spain — IBEX 35 (selection) ───
const IBEX: TickerEntry[] = [
  { ticker: "SAN.MC", expectedName: "Banco Santander", indices: ["IBEX 35"] },
  { ticker: "BBVA.MC", expectedName: "BBVA", indices: ["IBEX 35"] },
  { ticker: "ITX.MC", expectedName: "Inditex", indices: ["IBEX 35"] },
  { ticker: "IBE.MC", expectedName: "Iberdrola", indices: ["IBEX 35"] },
  { ticker: "TEF.MC", expectedName: "Telefónica", indices: ["IBEX 35"] },
  { ticker: "REP.MC", expectedName: "Repsol", indices: ["IBEX 35"] },
  { ticker: "AMS.MC", expectedName: "Amadeus IT", indices: ["IBEX 35"] },
  { ticker: "FER.MC", expectedName: "Ferrovial", indices: ["IBEX 35"] },
  { ticker: "CABK.MC", expectedName: "CaixaBank", indices: ["IBEX 35"] },
  { ticker: "ENG.MC", expectedName: "Enagás", indices: ["IBEX 35"] },
  { ticker: "RED.MC", expectedName: "Red Eléctrica", indices: ["IBEX 35"] },
  { ticker: "ACS.MC", expectedName: "ACS", indices: ["IBEX 35"] },
  { ticker: "CLNX.MC", expectedName: "Cellnex", indices: ["IBEX 35"] },
  { ticker: "GRF.MC", expectedName: "Grifols", indices: ["IBEX 35"] },
  { ticker: "MAP.MC", expectedName: "Mapfre", indices: ["IBEX 35"] },
]

// ─── Italy (selection) ───
const ITALY: TickerEntry[] = [
  { ticker: "ENI.MI", expectedName: "Eni", indices: [] },
  { ticker: "ISP.MI", expectedName: "Intesa Sanpaolo", indices: [] },
  { ticker: "ENEL.MI", expectedName: "Enel", indices: [] },
  { ticker: "UCG.MI", expectedName: "UniCredit", indices: [] },
  { ticker: "G.MI", expectedName: "Generali", indices: [] },
  { ticker: "RACE.MI", expectedName: "Ferrari", indices: [] },
  { ticker: "LDO.MI", expectedName: "Leonardo", indices: [] },
  { ticker: "TIT.MI", expectedName: "Telecom Italia", indices: [] },
  { ticker: "BAMI.MI", expectedName: "Banco BPM", indices: [] },
  { ticker: "CPR.MI", expectedName: "Campari", indices: [] },
  { ticker: "TEN.MI", expectedName: "Tenaris", indices: [] },
  { ticker: "SRG.MI", expectedName: "Snam", indices: [] },
  { ticker: "PRY.MI", expectedName: "Prysmian", indices: [] },
  { ticker: "PST.MI", expectedName: "Poste Italiane", indices: [] },
  { ticker: "STMMI.MI", expectedName: "STMicro (Milan)", indices: [] },
]

// ─── Portugal ───
const PORTUGAL: TickerEntry[] = [
  { ticker: "EDP.LS", expectedName: "EDP", indices: [] },
  { ticker: "GALP.LS", expectedName: "Galp Energia", indices: [] },
  { ticker: "JMT.LS", expectedName: "Jerónimo Martins", indices: [] },
  { ticker: "SON.LS", expectedName: "Sonae", indices: [] },
]

// ─── Finland ───
const FINLAND: TickerEntry[] = [
  { ticker: "NOKIA.HE", expectedName: "Nokia", indices: [] },
  { ticker: "SAMPO.HE", expectedName: "Sampo", indices: [] },
  { ticker: "FORTUM.HE", expectedName: "Fortum", indices: [] },
  { ticker: "UPM.HE", expectedName: "UPM-Kymmene", indices: [] },
  { ticker: "STERV.HE", expectedName: "Stora Enso", indices: [] },
  { ticker: "NESTE.HE", expectedName: "Neste", indices: [] },
  { ticker: "WRT1V.HE", expectedName: "Wärtsilä", indices: [] },
  { ticker: "KNEBV.HE", expectedName: "Kone", indices: [] },
  { ticker: "ELISA.HE", expectedName: "Elisa", indices: [] },
]

// ─── Ireland ───
const IRELAND: TickerEntry[] = [
  { ticker: "CRH.L", expectedName: "CRH", indices: [] },
  { ticker: "SKG.L", expectedName: "Smurfit Kappa", indices: [] },
  { ticker: "KYGA.L", expectedName: "Kerry Group", indices: [] },
  { ticker: "BIRG.L", expectedName: "Bank of Ireland", indices: [] },
]

// ─── Austria ───
const AUSTRIA: TickerEntry[] = [
  { ticker: "VOE.VI", expectedName: "Voestalpine", indices: [] },
  { ticker: "OMV.VI", expectedName: "OMV", indices: [] },
  { ticker: "EBS.VI", expectedName: "Erste Group", indices: [] },
  { ticker: "VER.VI", expectedName: "Verbund", indices: [] },
  { ticker: "WIE.VI", expectedName: "Wienerberger", indices: [] },
]

// ─── Merge & deduplicate ───

function buildUniverse(): TickerEntry[] {
  const all = [
    ...CAC40, ...CAC_NEXT20, ...CAC_MID60,
    ...DAX40, ...AEX25, ...BEL20, ...IBEX,
    ...ITALY, ...PORTUGAL, ...FINLAND, ...IRELAND, ...AUSTRIA,
  ]

  const map = new Map<string, TickerEntry>()
  for (const entry of all) {
    const existing = map.get(entry.ticker)
    if (existing) {
      const merged = new Set([...existing.indices, ...entry.indices])
      existing.indices = Array.from(merged)
    } else {
      map.set(entry.ticker, { ...entry, indices: [...entry.indices] })
    }
  }

  // Tag SBF 120 = CAC 40 + Next 20 + Mid 60
  for (const entry of map.values()) {
    if (
      entry.indices.includes("CAC 40") ||
      entry.indices.includes("CAC Next 20") ||
      entry.indices.includes("CAC Mid 60")
    ) {
      if (!entry.indices.includes("SBF 120")) {
        entry.indices.push("SBF 120")
      }
    }
  }

  return Array.from(map.values())
}

export const UNIVERSE = buildUniverse()

export const ALL_INDICES = [
  "CAC 40",
  "CAC Next 20",
  "CAC Mid 60",
  "SBF 120",
  "DAX 40",
  "AEX 25",
  "BEL 20",
  "IBEX 35",
] as const

export type IndexName = (typeof ALL_INDICES)[number]
