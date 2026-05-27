import express from "express";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

// Load environment variables in development
dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with generous limit
app.use(express.json({ limit: "50mb" }));

// Robust helper to sanitize and parse the service account private key
function cleanPrivateKey(key: string): string {
  if (!key) return "";

  let cleaned = key.trim();

  try {
    const parsed = JSON.parse(cleaned);

    if (parsed?.private_key) {
      cleaned = parsed.private_key;
    }
  } catch {}

  cleaned = cleaned
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r/g, "")
    .trim();

  const begin = "-----BEGIN PRIVATE KEY-----";
  const end = "-----END PRIVATE KEY-----";

  const beginIndex = cleaned.indexOf(begin);
  const endIndex = cleaned.indexOf(end);

  if (beginIndex !== -1 && endIndex !== -1) {
    cleaned = cleaned.substring(beginIndex, endIndex + end.length);
  }

  return cleaned;
}

// Helper to initialize Google Sheets Client
function getSheetsClient() {
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Try extracting from full JSON credentials if pasted inside GOOGLE_SERVICE_ACCOUNT_KEY
  try {
    const parsed = JSON.parse(rawKey.trim());
    if (parsed && typeof parsed === "object") {
      if (parsed.private_key) {
        rawKey = parsed.private_key;
      }
      if (parsed.client_email && !email) {
        email = parsed.client_email;
      }
    }
  } catch (e) {
    // Treat as raw PEM string or key
  }

  const privateKey = cleanPrivateKey(rawKey);

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error(
      "Configuración de Google Sheets incompleta o inválida. " +
      "Por favor defina GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY y GOOGLE_SHEET_ID en las variables de entorno de Vercel."
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

interface TableSchema {
  sheetHeaders: string[];
  clientToSheet: Record<string, string>;
  sheetToClient: Record<string, string>;
}

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  TURNOSV2: {
    sheetHeaders: ["id", "name", "startTime", "endTime", "durationHours"],
    clientToSheet: {
      id: "id",
      name: "name",
      startTime: "startTime",
      endTime: "endTime",
      durationHours: "durationHours"
    },
    sheetToClient: {
      id: "id",
      name: "name",
      startTime: "startTime",
      endTime: "endTime",
      durationHours: "durationHours"
    }
  },
  PALETIZADORAV2: {
    sheetHeaders: ["id", "tipo", "nombre", "hac_id"],
    clientToSheet: {
      id: "id",
      type: "tipo",
      name: "nombre",
      hacId: "hac_id"
    },
    sheetToClient: {
      id: "id",
      tipo: "type",
      nombre: "name",
      hac_id: "hacId"
    }
  },
  ENSACADORAV2: {
    sheetHeaders: ["id", "tipo", "nombre", "boquillas", "hac_id", "es_punto_de_muestreo?"],
    clientToSheet: {
      id: "id",
      type: "tipo",
      name: "nombre",
      nozzles: "boquillas",
      hacId: "hac_id",
      isSamplingPoint: "es_punto_de_muestreo?"
    },
    sheetToClient: {
      id: "id",
      tipo: "type",
      nombre: "name",
      boquillas: "nozzles",
      hac_id: "hacId",
      "es_punto_de_muestreo?": "isSamplingPoint"
    }
  },
  HACSV2: {
    sheetHeaders: ["id", "hac", "descripcion_hac", "gpo_codigo_objeto", "equipo", "es_fechador?", "es_balanza?"],
    clientToSheet: {
      id: "id",
      hac: "hac",
      detail: "descripcion_hac",
      gpoCodObjeto: "gpo_codigo_objeto",
      equipment: "equipo",
      isDater: "es_fechador?",
      isScale: "es_balanza?"
    },
    sheetToClient: {
      id: "id",
      hac: "hac",
      descripcion_hac: "detail",
      gpo_codigo_objeto: "gpoCodObjeto",
      equipo: "equipment",
      "es_fechador?": "isDater",
      "es_balanza?": "isScale"
    }
  },
  CAUSASV2: {
    sheetHeaders: [
      "id",
      "hac",
      "descripcion",
      "parte_objeto",
      "grupo_código_sintoma",
      "codigo_sintoma",
      "causa_sap",
      "grupo_codigo_causa",
      "codigo_causa",
      "tipo_paro"
    ],
    clientToSheet: {
      id: "id",
      hac: "hac",
      text: "descripcion",
      partObject: "parte_objeto",
      symptomGroup: "grupo_código_sintoma",
      symptomCode: "codigo_sintoma",
      sapCause: "causa_sap",
      causeGroup: "grupo_codigo_causa",
      causeCode: "codigo_causa",
      stopType: "tipo_paro"
    },
    sheetToClient: {
      id: "id",
      hac: "hac",
      descripcion: "text",
      parte_objeto: "partObject",
      grupo_código_sintoma: "symptomGroup",
      codigo_sintoma: "symptomCode",
      causa_sap: "sapCause",
      grupo_codigo_causa: "causeGroup",
      codigo_causa: "causeCode",
      tipo_paro: "stopType"
    }
  },
  MATERIALESV2: {
    sheetHeaders: [
      "id",
      "nombre",
      "codigo_sap",
      "peso_embalaje",
      "peso_bolsa",
      "es_pallet?",
      "es_productivo?",
      "es_insumo?",
      "es_bigbag?"
    ],
    clientToSheet: {
      id: "id",
      name: "nombre",
      code: "codigo_sap",
      packingWeight: "peso_embalaje",
      bagWeight: "peso_bolsa",
      isPallet: "es_pallet?",
      isProductive: "es_productivo?",
      isSupply: "es_insumo?",
      isBigBag: "es_bigbag?"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      codigo_sap: "code",
      peso_embalaje: "packingWeight",
      peso_bolsa: "bagWeight",
      "es_pallet?": "isPallet",
      "es_productivo?": "isProductive",
      "es_insumo?": "isSupply",
      "es_bigbag?": "isBigBag"
    }
  },
  CAPACIDADESV2: {
    sheetHeaders: ["id", "ensacadora_id", "peletizadora_id", "material_id", "bdp"],
    clientToSheet: {
      id: "id",
      baggerId: "ensacadora_id",
      palletizerId: "peletizadora_id",
      materialId: "material_id",
      bdp: "bdp"
    },
    sheetToClient: {
      id: "id",
      ensacadora_id: "baggerId",
      peletizadora_id: "palletizerId",
      material_id: "materialId",
      bdp: "bdp"
    }
  },
  PUNTOS_CARGAV2: {
    sheetHeaders: ["id", "nombre", "tipo"],
    clientToSheet: {
      id: "id",
      name: "nombre",
      type: "tipo"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      tipo: "type"
    }
  },
  EMPRESASV2: {
    sheetHeaders: ["id", "nombre", "dirección", "cuit", "telefono", "email"],
    clientToSheet: {
      id: "id",
      name: "nombre",
      address: "dirección",
      taxId: "cuit",
      phone: "telefono",
      email: "email"
    },
    sheetToClient: {
      id: "id",
      nombre: "name",
      "dirección": "address",
      cuit: "taxId",
      telefono: "phone",
      email: "email"
    }
  },
  PROVEEDORES_BOLSAV2: {
    sheetHeaders: ["id", "nombre", "direccion", "telefono", "email"],
    clientToSheet: {
      id: "id",
      nombre: "nombre",
      direccion: "direccion",
      telefono: "telefono",
      email: "email"
    },
    sheetToClient: {
      id: "id",
      nombre: "nombre",
      direccion: "direccion",
      telefono: "telefono",
      email: "email"
    }
  },
  VEHICULOSV2: {
    sheetHeaders: ["id", "marca", "identificación", "tipo", "carga_maxima"],
    clientToSheet: {
      id: "id",
      marca: "marca",
      identificación: "identificación",
      tipo: "tipo",
      carga_maxima: "carga_maxima"
    },
    sheetToClient: {
      id: "id",
      marca: "marca",
      identificación: "identificación",
      tipo: "tipo",
      carga_maxima: "carga_maxima"
    }
  },
  CARGA_COMBUSTIBLEV2: {
    sheetHeaders: ["id", "fecha", "unidad_movil", "id_operario", "descripcion_operario", "litros_combustible"],
    clientToSheet: {
      id: "id",
      date: "fecha",
      unidad_movil: "unidad_movil",
      id_operario: "id_operario",
      descripcion_operario: "descripcion_operario",
      litros_combustible: "litros_combustible"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      unidad_movil: "unidad_movil",
      id_operario: "id_operario",
      descripcion_operario: "descripcion_operario",
      litros_combustible: "litros_combustible"
    }
  },
  USUARIOSV2: {
    sheetHeaders: ["dni", "nombre", "usuariosap", "email", "email2", "puesto", "perfil", "permisos"],
    clientToSheet: {
      dni: "dni",
      name: "nombre",
      sapUser: "usuariosap",
      email: "email",
      email2: "email2",
      position: "puesto",
      profile: "perfil",
      permissions: "permisos"
    },
    sheetToClient: {
      dni: "dni",
      nombre: "name",
      usuariosap: "sapUser",
      email: "email",
      email2: "email2",
      puesto: "position",
      perfil: "profile",
      permisos: "permissions"
    }
  },
  PRODUCCIONV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripción_turno",
      "palletizadora_id",
      "hac_paletizadora",
      "ensacadora_id",
      "hac_ensacadora",
      "material_id",
      "decripcion_material",
      "bolsas_producidas",
      "tn_producidas",
      "bdp_teorico",
      "boquillas_turno",
      "proveedor_bolsa",
      "bolsas_rech_ensacadora",
      "bolsas_sin_boquilla",
      "bolsas_rech_ventocheck",
      "bolsas_rech_transporte",
      "rendimineto",
      "disponibilidad",
      "oee",
      "disponibilidad_boquillas"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripción_turno",
      palletizerId: "palletizadora_id",
      palletizerHac: "hac_paletizadora",
      baggerId: "ensacadora_id",
      baggerHac: "hac_ensacadora",
      materialId: "material_id",
      materialDescription: "decripcion_material",
      bagsProduced: "bolsas_producidas",
      tonsProduced: "tn_producidas",
      bdp: "bdp_teorico",
      availableNozzlesShift: "boquillas_turno",
      bagProvider: "proveedor_bolsa",
      discardedBagsBagger: "bolsas_rech_ensacadora",
      notNozzledBags: "bolsas_sin_boquilla",
      discardedBagsVentocheck: "bolsas_rech_ventocheck",
      discardedBagsTransport: "bolsas_rech_transporte",
      yield: "rendimineto",
      availability: "disponibilidad",
      oee: "oee",
      nozzleAvailability: "disponibilidad_boquillas"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripción_turno: "shiftDescription",
      palletizadora_id: "palletizerId",
      hac_paletizadora: "palletizerHac",
      ensacadora_id: "baggerId",
      hac_ensacadora: "baggerHac",
      material_id: "materialId",
      decripcion_material: "materialDescription",
      bolsas_producidas: "bagsProduced",
      tn_producidas: "tonsProduced",
      bdp_teorico: "bdp",
      boquillas_turno: "availableNozzlesShift",
      proveedor_bolsa: "bagProvider",
      bolsas_rech_ensacadora: "discardedBagsBagger",
      bolsas_sin_boquilla: "notNozzledBags",
      bolsas_rech_ventocheck: "discardedBagsVentocheck",
      bolsas_rech_transporte: "discardedBagsTransport",
      rendimineto: "yield",
      disponibilidad: "availability",
      oee: "oee",
      disponibilidad_boquillas: "nozzleAvailability"
    }
  },
  PAROS_BOQUILLASV2: {
    sheetHeaders: [
      "id",
      "produccion_id",
      "nro_boquilla",
      "hora_inicio",
      "hora_fin",
      "todo_el_turno",
      "observacion"
    ],
    clientToSheet: {
      id: "id",
      productionId: "produccion_id",
      nozzleNumber: "nro_boquilla",
      startTime: "hora_inicio",
      endTime: "hora_fin",
      isAllShift: "todo_el_turno",
      observation: "observacion"
    },
    sheetToClient: {
      id: "id",
      produccion_id: "productionId",
      nro_boquilla: "nozzleNumber",
      hora_inicio: "startTime",
      hora_fin: "endTime",
      todo_el_turno: "isAllShift",
      observacion: "observation"
    }
  },
  CONTROL_FECHADORV2: {
    sheetHeaders: [
      "idctrlfechador",
      "fecha",
      "maquinista_id",
      "descripcion_maquinista",
      "turno_id",
      "hac_fechador",
      "purga?",
      "nivel_recipiente",
      "calidad_impresion",
      "stock_tinta",
      "stock_solvente",
      "stock_cabezales",
      "observaciones"
    ],
    clientToSheet: {
      id: "idctrlfechador",
      date: "fecha",
      userId: "maquinista_id",
      userName: "descripcion_maquinista",
      shiftId: "turno_id",
      hac: "hac_fechador",
      purge: "purga?",
      containerLevel: "nivel_recipiente",
      printQuality: "calidad_impresion",
      inkStock: "stock_tinta",
      solventStock: "stock_solvente",
      headsStock: "stock_cabezales",
      observations: "observaciones"
    },
    sheetToClient: {
      idctrlfechador: "id",
      fecha: "date",
      maquinista_id: "userId",
      descripcion_maquinista: "userName",
      turno_id: "shiftId",
      hac_fechador: "hac",
      "purga?": "purge",
      nivel_recipiente: "containerLevel",
      calidad_impresion: "printQuality",
      stock_tinta: "inkStock",
      stock_solvente: "solventStock",
      stock_cabezales: "headsStock",
      observaciones: "observations"
    }
  },
  CONTROL_BALANZAV2: {
    sheetHeaders: [
      "idctrlbalanza",
      "fecha",
      "maquinista_id",
      "maquinista_nombre",
      "turno_id",
      "hac",
      "peso_1",
      "peso_2",
      "peso_3",
      "peso_patron",
      "media",
      "bias",
      "rango",
      "observaciones"
    ],
    clientToSheet: {
      id: "idctrlbalanza",
      date: "fecha",
      userId: "maquinista_id",
      userName: "maquinista_nombre",
      shiftId: "turno_id",
      hac: "hac",
      weight1: "peso_1",
      weight2: "peso_2",
      weight3: "peso_3",
      patternWeight: "peso_patron",
      average: "media",
      bias: "bias",
      range: "rango",
      observations: "observaciones"
    },
    sheetToClient: {
      idctrlbalanza: "id",
      fecha: "date",
      maquinista_id: "userId",
      maquinista_nombre: "userName",
      turno_id: "shiftId",
      hac: "hac",
      peso_1: "weight1",
      peso_2: "weight2",
      peso_3: "weight3",
      peso_patron: "patternWeight",
      media: "average",
      bias: "bias",
      rango: "range",
      observaciones: "observations"
    }
  },
  CAMBIO_PRODUCTOV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "maquinista_id",
      "maquinista_nombre",
      "maquina_id",
      "valvula_silo_cerrada",
      "circuito_vaciado",
      "maquina_limpia",
      "tolva_vaciada",
      "silo_cambiado",
      "fechador_actualizado",
      "envase_correcto",
      "dos_bib_bags_pal",
      "muestreo_color",
      "muestra_enviada_lab",
      "producto_liberado",
      "material_anterior_id",
      "material_nuevo_id",
      "motivo_cambio",
      "lab_operador_id",
      "lab_operador_name",
      "p_calcinacion",
      "aire_incorporado",
      "porcentaje_ck_drx",
      "estado_aprobacion",
      "observacion_rechazo"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      operatorId: "maquinista_id",
      operatorName: "maquinista_nombre",
      machineId: "maquina_id",
      siloValveClosed: "valvula_silo_cerrada",
      circuitEmptied: "circuito_vaciado",
      machineCleaned: "maquina_limpia",
      hopperEmptied: "tolva_vaciada",
      siloChanged: "silo_cambiado",
      setupChanged: "fechador_actualizado",
      packagingChanged: "envase_correcto",
      twoBigBagsPalletized: "dos_bib_bags_pal",
      colorSampling: "muestreo_color",
      sampleSentToLab: "muestra_enviada_lab",
      productReleased: "producto_liberado",
      previousMaterialId: "material_anterior_id",
      newMaterialId: "material_nuevo_id",
      changeReason: "motivo_cambio",
      labOperatorId: "lab_operador_id",
      labOperatorName: "lab_operador_name",
      calcinationLoss: "p_calcinacion",
      incorporatedAir: "aire_incorporado",
      ckPercentageByDrx: "porcentaje_ck_drx",
      approvalStatus: "estado_aprobacion",
      rejectionObservation: "observacion_rechazo"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      maquinista_id: "operatorId",
      maquinista_nombre: "operatorName",
      maquina_id: "machineId",
      valvula_silo_cerrada: "siloValveClosed",
      circuito_vaciado: "circuitEmptied",
      maquina_limpia: "machineCleaned",
      tolva_vaciada: "hopperEmptied",
      silo_cambiado: "siloChanged",
      fechador_actualizado: "setupChanged",
      envase_correcto: "packagingChanged",
      dos_bib_bags_pal: "twoBigBagsPalletized",
      muestreo_color: "colorSampling",
      muestra_enviada_lab: "sampleSentToLab",
      producto_liberado: "productReleased",
      material_anterior_id: "previousMaterialId",
      material_nuevo_id: "newMaterialId",
      motivo_cambio: "changeReason",
      lab_operador_id: "labOperatorId",
      lab_operador_name: "labOperatorName",
      p_calcinacion: "calcinationLoss",
      aire_incorporado: "incorporatedAir",
      porcentaje_ck_drx: "ckPercentageByDrx",
      estado_aprobacion: "approvalStatus",
      observacion_rechazo: "rejectionObservation"
    }
  },
  INVENTARIO_FISICOV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "material_id",
      "descripcion_material",
      "cantidad",
      "peso_tn",
      "usuario_id",
      "descripcion_maquinista"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      quantity: "cantidad",
      weightTn: "peso_tn",
      userId: "usuario_id",
      userName: "descripcion_maquinista"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      cantidad: "quantity",
      peso_tn: "weightTn",
      usuario_id: "userId",
      descripcion_maquinista: "userName"
    }
  },
  ESTADO_CALLESV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "punto_carga_id",
      "descripcion_punto_de_carga",
      "habilitada?",
      "materiales_permitidos",
      "observaciones_falla"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      loadingPointId: "punto_carga_id",
      loadingPointDescription: "descripcion_punto_de_carga",
      isEnabled: "habilitada?",
      materialIds: "materiales_permitidos",
      observation: "observaciones_falla"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      punto_carga_id: "loadingPointId",
      descripcion_punto_de_carga: "loadingPointDescription",
      "habilitada?": "isEnabled",
      materiales_permitidos: "materialIds",
      observaciones_falla: "observation"
    }
  },
  DESPACHOSV2: {
    sheetHeaders: [
      "id",
      "fecha",
      "turno_id",
      "descripcion_turno",
      "material_id",
      "descripcion_material",
      "toneladas",
      "usuario_id",
      "usuario_nombre"
    ],
    clientToSheet: {
      id: "id",
      date: "fecha",
      shiftId: "turno_id",
      shiftDescription: "descripcion_turno",
      materialId: "material_id",
      materialDescription: "descripcion_material",
      tons: "toneladas",
      userId: "usuario_id",
      userName: "usuario_nombre"
    },
    sheetToClient: {
      id: "id",
      fecha: "date",
      turno_id: "shiftId",
      descripcion_turno: "shiftDescription",
      material_id: "materialId",
      descripcion_material: "materialDescription",
      toneladas: "tons",
      usuario_id: "userId",
      usuario_nombre: "userName"
    }
  },
  PAROSV2: {
    sheetHeaders: [
      "idparo",
      "fecha",
      "fechafin",
      "máquina afectada",
      "turno",
      "material",
      "inicio",
      "fin",
      "duración",
      "detalle hac",
      "hac",
      "equipo",
      "texto de causa",
      "texto aviso",
      "texto síntoma",
      "causa sap",
      "gpo.cod. causa",
      "código causa",
      "tipo paro",
      "gpo.cód. objeto",
      "parte objeto",
      "gpo.cód. sintoma",
      "cód. sintoma",
      "usuario",
      "puesto de trabajo",
      "centro"
    ],
    clientToSheet: {
      id: "idparo",
      date: "fecha",
      finishDate: "fechafin",
      machineHacText: "máquina afectada",
      shiftName: "turno",
      materialDescription: "material",
      startTime: "inicio",
      endTime: "fin",
      durationTime: "duración",
      hacDetail: "detalle hac",
      hacName: "hac",
      equipment: "equipo",
      causeText: "texto de causa",
      noticeText: "texto aviso",
      symptomText: "texto síntoma",
      sapCause: "causa sap",
      causeGroup: "gpo.cod. causa",
      causeCode: "código causa",
      stopType: "tipo paro",
      gpoCodObjeto: "gpo.cód. objeto",
      partObject: "parte objeto",
      symptomGroup: "gpo.cód. sintoma",
      symptomCode: "cód. sintoma",
      user: "usuario",
      workCenter: "puesto de trabajo",
      center: "centro"
    },
    sheetToClient: {
      idparo: "id",
      fecha: "date",
      fechafin: "finishDate",
      "máquina afectada": "machineHacText",
      turno: "shiftName",
      material: "materialDescription",
      inicio: "startTime",
      fin: "endTime",
      duración: "durationTime",
      "detalle hac": "hacDetail",
      hac: "hacName",
      equipo: "equipment",
      "texto de causa": "causeText",
      "texto aviso": "noticeText",
      "texto síntoma": "symptomText",
      "causa sap": "sapCause",
      "gpo.cod. causa": "causeGroup",
      "código causa": "causeCode",
      "tipo paro": "stopType",
      "gpo.cód. objeto": "gpoCodObjeto",
      "parte objeto": "partObject",
      "gpo.cód. sintoma": "symptomGroup",
      "cód. sintoma": "symptomCode",
      usuario: "user",
      "puesto de trabajo": "workCenter",
      centro: "center"
    }
  }
}

const formatTimeHHMMSS = (timeStr: string | undefined): string => {
  if (!timeStr) return "00:00:00";
  const trimmed = timeStr.trim();
  if (trimmed.length === 5) {
    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }
  }
  if (trimmed.length === 8) {
    if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  return trimmed;
};

const calculateDurationTime = (startStr: string, endStr: string): string => {
  try {
    const sStr = formatTimeHHMMSS(startStr);
    const eStr = formatTimeHHMMSS(endStr);
    const [sh, sm, ss] = sStr.split(":").map(Number);
    const [eh, em, es] = eStr.split(":").map(Number);
    
    let startSecs = sh * 3600 + sm * 60 + ss;
    let endSecs = eh * 3600 + em * 60 + es;
    
    let diffSecs = endSecs - startSecs;
    if (diffSecs < 0) {
      diffSecs += 24 * 3600;
    }
    
    const h = Math.floor(diffSecs / 3600);
    const m = Math.floor((diffSecs % 3600) / 60);
    const s = diffSecs % 60;
    
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  } catch (err) {
    return "00:00:00";
  }
};

const durationMinutesFromHHMMSS = (timeStr: string | undefined): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length >= 2) {
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    return h * 60 + m;
  }
  return 0;
};

function parseRowToClientObject(headers: string[], row: any[], tableName: string): any {
  const rowObj: any = {};
  let hasValidValue = false;
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];

  headers.forEach((header, index) => {
    if (header) {
      const val = row[index] !== undefined ? row[index] : "";
      const clientKey = (schema && schema.sheetToClient[header]) ? schema.sheetToClient[header] : header;
      
      let parsedVal: any = val;
      if (typeof val === "string" && (val.trim().startsWith("[") || val.trim().startsWith("{"))) {
        try {
          parsedVal = JSON.parse(val);
        } catch (e) {
          parsedVal = val;
        }
      } else {
        parsedVal = val;
      }

      if (upperTable === "PAROS_BOQUILLASV2") {
        if (clientKey === "isAllShift") {
          parsedVal = (val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1);
        } else if (clientKey === "nozzleNumber") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "CONTROL_FECHADORV2") {
        if (clientKey === "inkStock" || clientKey === "solventStock" || clientKey === "headsStock") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "CONTROL_BALANZAV2") {
        if (["weight1", "weight2", "weight3", "patternWeight", "average", "bias", "range"].includes(clientKey)) {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "CAMBIO_PRODUCTOV2") {
        const booleanFields = [
          "siloValveClosed", "circuitEmptied", "machineCleaned", "hopperEmptied", "siloChanged",
          "setupChanged", "packagingChanged", "twoBigBagsPalletized", "colorSampling", "sampleSentToLab",
          "productReleased"
        ];
        if (booleanFields.includes(clientKey)) {
          parsedVal = (val === true || val === "true" || val === "SI" || val === "TRUE" || val === 1 || val === "CUMPLIDO");
        } else if (["calcinationLoss", "incorporatedAir", "ckPercentageByDrx"].includes(clientKey)) {
          parsedVal = val !== "" ? (Number(val) || 0) : undefined;
        }
      }

      if (upperTable === "INVENTARIO_FISICOV2") {
        if (clientKey === "quantity" || clientKey === "weightTn") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "ESTADO_CALLESV2") {
        if (clientKey === "isEnabled") {
          parsedVal = (val === true || val === "true" || val === "SI" || val === "SÍ" || val === "Habilitada" || val === "Habilitado" || val === "TRUE" || val === 1);
        }
      }

      if (upperTable === "DESPACHOSV2") {
        if (clientKey === "tons") {
          parsedVal = Number(val) || 0;
        }
      }

      if (upperTable === "PRODUCCIONV2") {
        const numericFields = [
          "bagsProduced",
          "tonsProduced",
          "bdp",
          "availableNozzlesShift",
          "discardedBagsBagger",
          "notNozzledBags",
          "discardedBagsVentocheck",
          "discardedBagsTransport",
          "yield",
          "availability",
          "oee"
        ];
        if (numericFields.includes(clientKey)) {
          parsedVal = Number(String(val).replace(",", ".")) || 0;
        }
      }

      // Standardize boolean fields across all tables to prevent false-positives
      const isBoolean = header.endsWith("?") || 
                        ["isPallet", "isProductive", "isSupply", "isBigBag", "isSamplingPoint", "isDater", "isScale", "isEnabled", "purge"].includes(clientKey);
      if (isBoolean) {
        const norm = String(val).trim().toUpperCase();
        parsedVal = (val === true || val === 1 || norm === "TRUE" || norm === "1" || norm === "SI" || norm === "SÍ" || norm === "HABILITADO" || norm === "HABILITADA" || norm === "CUMPLIDO");
      }

      // Standardize generic numeric fields that can be read as string
      if (upperTable === "MATERIALESV2" && ["packingWeight", "bagWeight"].includes(clientKey)) {
        parsedVal = Number(String(val).replace(",", ".")) || 0;
      }
      if (upperTable === "CAPACIDADESV2" && clientKey === "bdp") {
        parsedVal = Number(String(val).replace(",", ".")) || 0;
      }
      if (upperTable === "ENSACADORAV2" && clientKey === "nozzles") {
        parsedVal = Number(String(val).replace(",", ".")) || 0;
      }

      rowObj[clientKey] = parsedVal;

      if (val !== "") {
        hasValidValue = true;
      }
    }
  });

  return hasValidValue ? rowObj : null;
}

const PREDEFINED_HEADERS: Record<string, string[]> = {
  TURNOSV2: ["id", "name", "startTime", "endTime", "durationHours"],
  PALETIZADORAV2: ["id", "tipo", "nombre", "hac_id"],
  ENSACADORAV2: ["id", "tipo", "nombre", "boquillas", "hac_id", "es_punto_de_muestreo?"],
  HACSV2: ["id", "hac", "descripcion_hac", "gpo_codigo_objeto", "equipo", "es_fechador?", "es_balanza?"],
  CAUSASV2: ["id", "hac", "descripcion", "parte_objeto", "grupo_código_sintoma", "codigo_sintoma", "causa_sap", "grupo_codigo_causa", "codigo_causa", "tipo_paro"],
  MATERIALESV2: ["id", "nombre", "codigo_sap", "peso_embalaje", "peso_bolsa", "es_pallet?", "es_productivo?", "es_insumo?", "es_bigbag?"],
  CAPACIDADESV2: ["id", "ensacadora_id", "peletizadora_id", "material_id", "bdp"],
  USUARIOSV2: ["dni", "nombre", "usuariosap", "email", "email2", "puesto", "perfil", "permisos"],
  EMPRESASV2: ["id", "nombre", "dirección", "cuit", "telefono", "email"],
  PROVEEDORES_BOLSAV2: ["id", "nombre", "direccion", "telefono", "email"],
  VEHICULOSV2: ["id", "marca", "identificación", "tipo", "carga_maxima"],
  CARGA_COMBUSTIBLEV2: ["id", "fecha", "unidad_movil", "id_operario", "descripcion_operario", "litros_combustible"],
  PUNTOS_CARGAV2: ["id", "nombre", "tipo"],
  DESPACHOSV2: [
    "id", "fecha", "turno_id", "descripcion_turno", "material_id", "descripcion_material", "toneladas", "usuario_id", "usuario_nombre"
  ],
  PAROSV2: [
    "idparo", "fecha", "fechafin", "máquina afectada", "turno", "material", "inicio", "fin", "duración", "detalle hac", "hac", "equipo", "texto de causa", "texto aviso", "texto síntoma", "causa sap", "gpo.cod. causa", "código causa", "tipo paro", "gpo.cód. objeto", "parte objeto", "gpo.cód. sintoma", "cód. sintoma", "usuario", "puesto de trabajo", "centro"
  ],
  PRODUCCIONV2: [
    "id",
    "fecha",
    "turno_id",
    "descripción_turno",
    "palletizadora_id",
    "hac_paletizadora",
    "ensacadora_id",
    "hac_ensacadora",
    "material_id",
    "decripcion_material",
    "bolsas_producidas",
    "tn_producidas",
    "bdp_teorico",
    "boquillas_turno",
    "proveedor_bolsa",
    "bolsas_rech_ensacadora",
    "bolsas_sin_boquilla",
    "bolsas_rech_ventocheck",
    "bolsas_rech_transporte",
    "rendimineto",
    "disponibilidad",
    "oee",
    "disponibilidad_boquillas"
  ],
  PAROS_BOQUILLASV2: [
    "id",
    "produccion_id",
    "nro_boquilla",
    "hora_inicio",
    "hora_fin",
    "todo_el_turno",
    "observacion"
  ],
  CONTROL_FECHADORV2: [
    "idctrlfechador", "fecha", "maquinista_id", "descripcion_maquinista", "turno_id", "hac_fechador", "purga?", "nivel_recipiente", "calidad_impresion", "stock_tinta", "stock_solvente", "stock_cabezales", "observaciones"
  ],
  CONTROL_BALANZAV2: [
    "idctrlbalanza", "fecha", "maquinista_id", "maquinista_nombre", "turno_id", "hac", "peso_1", "peso_2", "peso_3", "peso_patron", "media", "bias", "rango", "observaciones"
  ],
  INVENTARIO_FISICOV2: [
    "id", "fecha", "turno_id", "descripcion_turno", "material_id", "descripcion_material", "cantidad", "peso_tn", "usuario_id", "descripcion_maquinista"
  ],
  CAMBIO_PRODUCTOV2: [
    "id", "fecha", "turno_id", "maquinista_id", "maquinista_nombre", "maquina_id", "valvula_silo_cerrada", "circuito_vaciado", "maquina_limpia", "tolva_vaciada", "silo_cambiado", "fechador_actualizado", "envase_correcto", "dos_bib_bags_pal", "muestreo_color", "muestra_enviada_lab", "producto_liberado", "material_anterior_id", "material_nuevo_id", "motivo_cambio", "lab_operador_id", "lab_operador_name", "p_calcinacion", "aire_incorporado", "porcentaje_ck_drx", "estado_aprobacion", "observacion_rechazo"
  ],
  ESTADO_CALLESV2: [
    "id", "fecha", "turno_id", "descripcion_turno", "punto_carga_id", "descripcion_punto_de_carga", "habilitada?", "materiales_permitidos", "observaciones_falla"
  ]
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 5, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isQuota = error.status === 429 || 
                    error.code === 429 || 
                    error.message?.includes("Quota exceeded") || 
                    error.message?.includes("Read requests") ||
                    error.message?.includes("rate limit");
    if (isQuota && retries > 0) {
      console.warn(`Sheets API rate limit hit (429). Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * 500));
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Thread-safe and rate-limit proof promise cache for sheet names
let sheetNamesPromise: Promise<string[]> | null = null;
let lastSheetNamesFetch = 0;
const SHEET_NAMES_CACHE_TTL = 300000; // 5 minutes cache

async function getSheetNames(sheets: any, spreadsheetId: string): Promise<string[]> {
  const now = Date.now();
  if (sheetNamesPromise && (now - lastSheetNamesFetch < SHEET_NAMES_CACHE_TTL)) {
    return sheetNamesPromise;
  }
  
  lastSheetNamesFetch = now;
  sheetNamesPromise = (async () => {
    try {
      const response: any = await callWithRetry(() => sheets.spreadsheets.get({ spreadsheetId }));
      return response.data.sheets?.map((s: any) => s.properties?.title) || [];
    } catch (err) {
      sheetNamesPromise = null;
      lastSheetNamesFetch = 0;
      throw err;
    }
  })();
  
  return sheetNamesPromise;
}

// Ensure sheet exists; if not, create it
async function ensureSheetExists(sheets: any, spreadsheetId: string, tableName: string): Promise<boolean> {
  try {
    const sheetNames = await getSheetNames(sheets, spreadsheetId);
    
    if (sheetNames.includes(tableName)) {
      return true;
    }

    // Create the sheet
    await callWithRetry(() => sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tableName,
              },
            },
          },
        ],
      },
    }));
    
    // Clear cache to force a refresh on the next fetch
    sheetNamesPromise = null;
    lastSheetNamesFetch = 0;
    return true;
  } catch (error) {
    console.error(`Error ensuring sheet existence for ${tableName}:`, error);
    return false;
  }
}

// ----------------------------------------------------
// DATABASE OPERATION HELPERS & SAFETY WRAPPER METHODS
// ----------------------------------------------------

const verifiedTables = new Set<string>();

// 1. Ensure sheet exists AND column headers row is correct (Point 1, 7)
async function ensureHeadersAndColumns(sheets: any, spreadsheetId: string, tableName: string): Promise<string[]> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  let expectedHeaders = schema ? schema.sheetHeaders : (PREDEFINED_HEADERS[upperTable] || []);

  if (verifiedTables.has(upperTable)) {
    return expectedHeaders;
  }

  await ensureSheetExists(sheets, spreadsheetId, tableName);

  // Read current Row 1
  const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tableName}!A1:ZZ1`,
  }));

  const existingRows = response.data.values;
  let existingHeaders: string[] = existingRows && existingRows[0] ? existingRows[0].map((h: any) => String(h || "").trim()) : [];

  if (upperTable === "PRODUCCIONV2" && existingHeaders.some(h => h.toLowerCase() === "novedades_boquillas")) {
    console.log(`[ensureHeadersAndColumns] Found obsolete column 'novedades_boquillas' in PRODUCCIONV2 sheet, clearing and rewritimg headers.`);
    existingHeaders = existingHeaders.filter(h => h.toLowerCase() !== "novedades_boquillas");
    await callWithRetry(() => sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tableName}!A1:ZZ1`,
    }));
    await callWithRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tableName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [existingHeaders],
      },
    }));
  }

  if (existingHeaders.length === 0 || existingHeaders.every(h => h === "")) {
    console.log(`[ensureHeadersAndColumns] Table ${tableName} header is empty. Writing default headers:`, expectedHeaders);
    await callWithRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tableName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [expectedHeaders],
      },
    }));
    verifiedTables.add(upperTable);
    return expectedHeaders;
  }

  // Check if columns are missing
  const missingHeaders = expectedHeaders.filter(h => !existingHeaders.includes(h));
  if (missingHeaders.length > 0) {
    console.log(`[ensureHeadersAndColumns] Table ${tableName} is missing columns. Appending missing columns securely:`, missingHeaders);
    const updatedHeaders = [...existingHeaders, ...missingHeaders];
    await callWithRetry(() => sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tableName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedHeaders],
      },
    }));
    verifiedTables.add(upperTable);
    return updatedHeaders;
  }

  verifiedTables.add(upperTable);
  return existingHeaders;
}

// 2. Identify the matching ID Column name in sheet and property keyword in client objects
function getIdColumnAndKey(tableName: string): { sheetCol: string; clientKey: string } {
  const upper = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upper];
  if (!schema) {
    return { sheetCol: "id", clientKey: "id" };
  }
  const idFields = ["id", "idparo", "idctrlfechador", "idctrlbalanza", "dni"];
  const sheetCol = schema.sheetHeaders.find(h => idFields.includes(h.toLowerCase())) || schema.sheetHeaders[0];
  const clientKey = schema.sheetToClient[sheetCol] || sheetCol;
  return { sheetCol, clientKey };
}

// 3. Robust comparison of records to skip redundant updates (Point 8, Concurrency safety)
function areRecordsEqual(recordA: any, recordB: any, schemaHeaders: string[], schema: any): boolean {
  if (!recordA || !recordB) return false;
  for (const header of schemaHeaders) {
    const key = schema ? schema.sheetToClient[header] || header : header;
    const valA = recordA[key];
    const valB = recordB[key];
    
    const normalize = (v: any) => {
      if (v === undefined || v === null) return "";
      if (typeof v === "object") {
        try { return JSON.stringify(v); } catch { return ""; }
      }
      return String(v).trim();
    };
    
    if (normalize(valA) !== normalize(valB)) {
      return false;
    }
  }
  return true;
}

// 4. Enrich item details on backend side dynamically when writing to Sheets
async function enrichProductionRecords(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [turnsRes, palRes, bagRes, matRes, hacRes, parosRes, causasRes, capacitiesRes] = await Promise.all([
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "TURNOSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "PALETIZADORAV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "ENSACADORAV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "MATERIALESV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "HACSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "PAROSV2!A1:Z50000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "CAUSASV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "CAPACIDADESV2!A1:Z5000" })).catch(() => null),
    ]);

    const parseRows = (res: any, tableName: string) => {
      if (!res || !res.data || !res.data.values || res.data.values.length < 2) return [];
      const headers = res.data.values[0];
      const rows = res.data.values.slice(1);
      return rows.map((r: any) => parseRowToClientObject(headers, r, tableName)).filter((x: any) => x !== null);
    };

    const dbShifts = parseRows(turnsRes, "TURNOSV2");
    const dbPalletizers = parseRows(palRes, "PALETIZADORAV2");
    const dbBaggers = parseRows(bagRes, "ENSACADORAV2");
    const dbMaterials = parseRows(matRes, "MATERIALESV2");
    const dbHacs = parseRows(hacRes, "HACSV2");
    const dbParos = parseRows(parosRes, "PAROSV2");
    const dbCauses = parseRows(causasRes, "CAUSASV2");
    const dbCapacities = parseRows(capacitiesRes, "CAPACIDADESV2");
    await enrichParosOnRead(sheets, spreadsheetId, dbParos);

    data.forEach((item: any) => {
      const shift = dbShifts.find((s: any) => s.id === item.shiftId);
      item.shiftDescription = shift ? shift.name : "";

      const pal = dbPalletizers.find((p: any) => p.id === item.palletizerId);
      const hacPal = dbHacs.find((h: any) => h.id === pal?.hacId);
      item.palletizerHac = hacPal ? hacPal.hac : (pal?.hacId || "");

      const bag = dbBaggers.find((b: any) => b.id === item.baggerId);
      const hacBag = dbHacs.find((h: any) => h.id === bag?.hacId);
      item.baggerHac = hacBag ? hacBag.hac : (bag?.hacId || "");

      const mat = dbMaterials.find((m: any) => m.id === item.materialId);
      item.materialDescription = mat ? mat.name : "";

      const shiftDurationHours = shift ? Number(shift.durationHours || 8) : 8;

      const stops = dbParos.filter((s: any) => 
        s.date === item.date && 
        s.shiftId === item.shiftId && 
        s.machineId === item.palletizerId
      );
      const stopMins = stops.reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
      const hsMarcha = Math.max(0, shiftDurationHours - (stopMins / 60));

      const externalStopMinutes = stops
        .filter((s: any) => {
          const c = dbCauses.find((cause: any) => 
            cause.id === s.causeId || 
            cause.text === s.causeText || 
            cause.descripcion === s.causeText || 
            cause.id === s.causeText
          );
          return (c && c.stopType === 'EXTERNO') || s.stopType === 'EXTERNO';
        })
        .reduce((sum: number, s: any) => sum + (Number(s.durationMinutes) || 0), 0);
      const externalStopHours = externalStopMinutes / 60;

      // Disponibilidad = (hs. de paro externo + hs. de marcha) / duración de turno
      let availabilityPercent = 100;
      if (shiftDurationHours > 0) {
        availabilityPercent = ((externalStopHours + hsMarcha) / shiftDurationHours) * 100;
      }
      item.availability = `${Math.min(100, Math.round(availabilityPercent))}%`;

      // Rendimiento = (totalTons / hsMarcha) / bdp_ponderado
      const contextReports = data.filter((r: any) => 
        r.date === item.date && 
        r.shiftId === item.shiftId && 
        r.palletizerId === item.palletizerId
      );

      let yieldPercent = 100;
      if (contextReports.length > 0 && hsMarcha > 0) {
        let totalTons = 0;
        let sumTonsOverBDP = 0;

        contextReports.forEach((r: any) => {
          const tons = Number(r.tonsProduced) || 0;
          totalTons += tons;

          // Find BDP in database capacities
          const cap = dbCapacities.find((c: any) => 
            String(c.palletizerId || "").trim().toUpperCase() === String(r.palletizerId || "").trim().toUpperCase() &&
            String(c.baggerId || "").trim().toUpperCase() === String(r.baggerId || "").trim().toUpperCase() &&
            String(c.materialId || "").trim().toUpperCase() === String(r.materialId || "").trim().toUpperCase()
          );

          const bdpVal = cap ? Number(cap.bdp) : (Number(r.bdp) || 100);
          if (bdpVal > 0) {
            sumTonsOverBDP += tons / bdpVal;
          } else {
            sumTonsOverBDP += tons / 100;
          }
        });

        if (totalTons > 0 && sumTonsOverBDP > 0) {
          const rate = totalTons / hsMarcha;
          const bdpPonderado = totalTons / sumTonsOverBDP; // tons/hour
          yieldPercent = (rate / bdpPonderado) * 100;
        } else {
          yieldPercent = 0;
        }
      } else {
        yieldPercent = 0;
      }
      
      item.yield = `${Math.round(yieldPercent)}%`;

      // OEE = rendimiento * disponibilidad
      const oeePercent = (availabilityPercent / 100) * (yieldPercent / 100) * 100;
      item.oee = `${Math.round(oeePercent)}%`;
    });
  } catch (enrichError) {
    console.error("Error enriching production data:", enrichError);
  }
}

async function autoRecalculateProductionMetrics(sheets: any, spreadsheetId: string) {
  try {
    console.log("[autoRecalculateProductionMetrics] Starting automatic OEE/Availability/Yield recalculation...");
    delete readCache["PRODUCCIONV2"];
    delete readCache["PAROSV2"];

    const productionList = await readTableData(sheets, spreadsheetId, "PRODUCCIONV2");
    if (!productionList || productionList.length === 0) {
      console.log("[autoRecalculateProductionMetrics] No production records found to recalculate.");
      return;
    }

    // Recalculate
    await enrichProductionRecords(sheets, spreadsheetId, productionList);

    console.log(`[autoRecalculateProductionMetrics] Recalculated ${productionList.length} records. Committing updates to PRODUCCIONV2...`);
    for (const report of productionList) {
      await updateRecord(sheets, spreadsheetId, "PRODUCCIONV2", report.id, report);
    }
    
    delete readCache["PRODUCCIONV2"];
    console.log("[autoRecalculateProductionMetrics] Done recalculating.");
  } catch (err) {
    console.error("[autoRecalculateProductionMetrics] Failed to auto-recalculate:", err);
  }
}

async function enrichInventarioFisico(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [turnsRes, matRes] = await Promise.all([
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "TURNOSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "MATERIALESV2!A1:Z5000" })).catch(() => null)
    ]);

    const parseRows = (res: any, tableName: string) => {
      if (!res || !res.data || !res.data.values || res.data.values.length < 2) return [];
      const headers = res.data.values[0];
      const rows = res.data.values.slice(1);
      return rows.map((r: any) => parseRowToClientObject(headers, r, tableName)).filter((x: any) => x !== null);
    };

    const dbShifts = parseRows(turnsRes, "TURNOSV2");
    const dbMaterials = parseRows(matRes, "MATERIALESV2");

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s.id === item.shiftId);
        item.shiftDescription = shift ? shift.name : "";
      }
      if (item.materialId) {
        const mat = dbMaterials.find((m: any) => m.id === item.materialId);
        item.materialDescription = mat ? mat.name : "";
      }
    });
  } catch (err) {
    console.error("Error enriching inventory:", err);
  }
}

async function enrichEstadoCalles(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [turnsRes, lanesRes] = await Promise.all([
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "TURNOSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "PUNTOS_CARGAV2!A1:Z5000" })).catch(() => null)
    ]);

    const parseRows = (res: any, tableName: string) => {
      if (!res || !res.data || !res.data.values || res.data.values.length < 2) return [];
      const headers = res.data.values[0];
      const rows = res.data.values.slice(1);
      return rows.map((r: any) => parseRowToClientObject(headers, r, tableName)).filter((x: any) => x !== null);
    };

    const dbShifts = parseRows(turnsRes, "TURNOSV2");
    const dbLanes = parseRows(lanesRes, "PUNTOS_CARGAV2");

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s.id === item.shiftId);
        item.shiftDescription = shift ? shift.name : "";
      }
      if (item.loadingPointId) {
        const lane = dbLanes.find((l: any) => l.id === item.loadingPointId);
        item.loadingPointDescription = lane ? lane.name : "";
      }
    });
  } catch (err) {
    console.error("Error enriching loading lanes:", err);
  }
}

async function enrichDespachos(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [turnsRes, matRes] = await Promise.all([
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "TURNOSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "MATERIALESV2!A1:Z5000" })).catch(() => null)
    ]);

    const parseRows = (res: any, tableName: string) => {
      if (!res || !res.data || !res.data.values || res.data.values.length < 2) return [];
      const headers = res.data.values[0];
      const rows = res.data.values.slice(1);
      return rows.map((r: any) => parseRowToClientObject(headers, r, tableName)).filter((x: any) => x !== null);
    };

    const dbShifts = parseRows(turnsRes, "TURNOSV2");
    const dbMaterials = parseRows(matRes, "MATERIALESV2");

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s.id === item.shiftId);
        item.shiftDescription = shift ? shift.name : "";
      }
      if (item.materialId) {
        const mat = dbMaterials.find((m: any) => m.id === item.materialId);
        item.materialDescription = mat ? mat.name : "";
      }
    });
  } catch (err) {
    console.error("Error enriching dispatches:", err);
  }
}

async function enrichParos(sheets: any, spreadsheetId: string, data: any[]) {
  if (!data || data.length === 0) return;
  try {
    const [turnsRes, palRes, bagRes, hacRes, matRes] = await Promise.all([
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "TURNOSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "PALETIZADORAV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "ENSACADORAV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "HACSV2!A1:Z5000" })).catch(() => null),
      callWithRetry(() => sheets.spreadsheets.values.get({ spreadsheetId, range: "MATERIALESV2!A1:Z5000" })).catch(() => null)
    ]);

    const parseRows = (res: any, tableName: string) => {
      if (!res || !res.data || !res.data.values || res.data.values.length < 2) return [];
      const headers = res.data.values[0];
      const rows = res.data.values.slice(1);
      return rows.map((r: any) => parseRowToClientObject(headers, r, tableName)).filter((x: any) => x !== null);
    };

    const dbShifts = parseRows(turnsRes, "TURNOSV2");
    const dbPalletizers = parseRows(palRes, "PALETIZADORAV2");
    const dbBaggers = parseRows(bagRes, "ENSACADORAV2");
    const dbHacs = parseRows(hacRes, "HACSV2");
    const dbMaterials = parseRows(matRes, "MATERIALESV2");

    data.forEach((item: any) => {
      if (item.shiftId) {
        const shift = dbShifts.find((s: any) => s.id === item.shiftId);
        item.shiftName = shift ? shift.name : "";
      }
      if (item.machineId) {
        const pal = dbPalletizers.find((p: any) => p.id === item.machineId) || dbBaggers.find((b: any) => b.id === item.machineId);
        const hacPal = dbHacs.find((h: any) => h.id === pal?.hacId || h.hac === pal?.hacId);
        // If there is no HAC related to this machine, use the machine's ID so we can map it back perfectly on read
        item.machineHacText = item.machineHacText || (hacPal ? hacPal.hac : (pal?.id || item.machineId));
      }
      if (item.materialId) {
        const mat = dbMaterials.find((m: any) => m.id === item.materialId);
        item.materialDescription = mat ? mat.name : "";
      }
      item.finishDate = item.date;
      item.center = "AMG0";
      item.startTime = formatTimeHHMMSS(item.startTime);
      item.endTime = formatTimeHHMMSS(item.endTime);
      item.durationTime = calculateDurationTime(item.startTime, item.endTime);
    });
  } catch (err) {
    console.error("Error enriching paros:", err);
  }
}

async function enrichDataIfNeeded(sheets: any, spreadsheetId: string, tableName: string, items: any[]) {
  const upper = tableName.toUpperCase();
  if (upper === "PRODUCCIONV2") {
    await enrichProductionRecords(sheets, spreadsheetId, items);
  } else if (upper === "INVENTARIO_FISICOV2") {
    await enrichInventarioFisico(sheets, spreadsheetId, items);
  } else if (upper === "ESTADO_CALLESV2") {
    await enrichEstadoCalles(sheets, spreadsheetId, items);
  } else if (upper === "DESPACHOSV2") {
    await enrichDespachos(sheets, spreadsheetId, items);
  } else if (upper === "PAROSV2") {
    await enrichParos(sheets, spreadsheetId, items);
  }
}

// 5. Insert single record securely using safe append on Sheets (Point 2)
async function insertRecord(sheets: any, spreadsheetId: string, tableName: string, item: any): Promise<void> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];
  
  // Clean item key mapping or enrichment
  await enrichDataIfNeeded(sheets, spreadsheetId, tableName, [item]);

  // Ensure and get correct column headers ordering for the sheet
  const headers = await ensureHeadersAndColumns(sheets, spreadsheetId, tableName);

  const row = headers.map((header) => {
    let val;
    if (schema) {
      const clientKey = schema.sheetToClient[header] || header;
      val = item[clientKey];
    } else {
      val = item[header];
      if (val === undefined) {
        const lowerHeader = header.toLowerCase();
        const matchingKey = Object.keys(item).find(k => k.toLowerCase() === lowerHeader);
        if (matchingKey) {
          val = item[matchingKey];
        }
      }
    }
    if (val === undefined || val === null) return "";
    if (typeof val === "object") {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return "";
      }
    }
    return val;
  });

  await callWithRetry(() => sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tableName}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  }));

  if (upperTable === "PRODUCCIONV2") {
    await syncProductionNozzles(sheets, spreadsheetId, item);
  }

  console.log(`[Database log: CREATE] Selected append insertion in table ${tableName}. ID: ${item.id || item.dni || item.idctrlfechador || item.idctrlbalanza || item.idparo || 'unknown'}`);
}

// 6. Update single record securely by searching by original ID (Point 3)
async function updateRecord(sheets: any, spreadsheetId: string, tableName: string, targetId: string, item: any): Promise<void> {
  const upperTable = tableName.toUpperCase();
  const schema = TABLE_SCHEMAS[upperTable];

  await enrichDataIfNeeded(sheets, spreadsheetId, tableName, [item]);

  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  }

  const { sheetCol } = getIdColumnAndKey(tableName);
  const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tableName}!A1:ZZ50000`,
  }));

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const idColIndex = headers.indexOf(sheetCol);

  if (idColIndex === -1) {
    console.warn(`[updateRecord] ID column ${sheetCol} not found in headers for ${tableName}. Performing append insert.`);
    await insertRecord(sheets, spreadsheetId, tableName, item);
    return;
  }

  let matchingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const idValueInRow = rows[i][idColIndex];
    if (idValueInRow !== undefined && String(idValueInRow).trim() === String(targetId).trim()) {
      matchingRowIndex = i + 1; // 1-based index in Google Sheets
      break;
    }
  }

  if (matchingRowIndex === -1) {
    console.log(`[updateRecord] ID ${targetId} not found in ${tableName}. Direct inserting as new row.`);
    await insertRecord(sheets, spreadsheetId, tableName, item);
    return;
  }

  const row = headers.map((header) => {
    let val;
    if (schema) {
      const clientKey = schema.sheetToClient[header] || header;
      val = item[clientKey];
    } else {
      val = item[header];
      if (val === undefined) {
        const lowerHeader = header.toLowerCase();
        const matchingKey = Object.keys(item).find(k => k.toLowerCase() === lowerHeader);
        if (matchingKey) {
          val = item[matchingKey];
        }
      }
    }
    if (val === undefined || val === null) return "";
    if (typeof val === "object") {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return "";
      }
    }
    return val;
  });

  await callWithRetry(() => sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tableName}!A${matchingRowIndex}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [row],
    },
  }));

  if (upperTable === "PRODUCCIONV2") {
    await syncProductionNozzles(sheets, spreadsheetId, item);
  }

  console.log(`[Database log: UPDATE] Updated row ${matchingRowIndex} in table ${tableName}. ID: ${targetId}`);
}

// 7. Delete nested nozzles linked with production report (Point 4)
async function deleteNozzlesForProduction(sheets: any, spreadsheetId: string, productionId: string) {
  try {
    const list = await readTableData(sheets, spreadsheetId, "PAROS_BOQUILLASV2");
    const matching = list.filter((n: any) => n.productionId === productionId);
    for (const match of matching) {
      await deleteRecord(sheets, spreadsheetId, "PAROS_BOQUILLASV2", match.id);
    }
  } catch (err) {
    console.error("Error deleting old nozzles for productionId " + productionId + ":", err);
  }
}

// 8. Safely push/sync nested nozzle entries to PAROS_BOQUILLASV2
async function syncProductionNozzles(sheets: any, spreadsheetId: string, item: any) {
  if (!item.nozzleNews || !Array.isArray(item.nozzleNews)) return;
  try {
    const nozzleNewsEntries = item.nozzleNews.map((news: any) => ({
      id: news.id,
      productionId: item.id,
      nozzleNumber: news.nozzleNumber,
      startTime: news.startTime,
      endTime: news.endTime,
      isAllShift: news.isAllShift === true || news.isAllShift === "true" || news.isAllShift === "SI" ? "SI" : "NO",
      observation: news.observation || ""
    }));

    await deleteNozzlesForProduction(sheets, spreadsheetId, item.id);

    for (const entry of nozzleNewsEntries) {
      await insertRecord(sheets, spreadsheetId, "PAROS_BOQUILLASV2", entry);
    }
  } catch (err) {
    console.error("Error syncing production nozzles:", err);
  }
}

// 9. Delete single record uniquely by original ID (Point 4)
async function deleteRecord(sheets: any, spreadsheetId: string, tableName: string, targetId: string): Promise<boolean> {
  const upperTable = tableName.toUpperCase();
  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  } else if (upperTable === "PAROS_BOQUILLASV2") {
    delete readCache["PRODUCCIONV2"];
  }

  const { sheetCol } = getIdColumnAndKey(tableName);

  if (upperTable === "PRODUCCIONV2") {
    await deleteNozzlesForProduction(sheets, spreadsheetId, targetId);
  }

  const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tableName}!A1:ZZ50000`,
  }));

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const idColIndex = headers.indexOf(sheetCol);

  if (idColIndex === -1) {
    console.warn(`[deleteRecord] ID column ${sheetCol} not found in ${tableName}`);
    return false;
  }

  let matchingRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const idValueInRow = rows[i][idColIndex];
    if (idValueInRow !== undefined && String(idValueInRow).trim() === String(targetId).trim()) {
      matchingRowIndex = i + 1; // 1-based index in Sheets
      break;
    }
  }

  if (matchingRowIndex === -1) {
    console.log(`[deleteRecord] ID ${targetId} not found in ${tableName}, nothing to delete.`);
    return false;
  }

  let deletedPhysically = false;
  try {
    const meta: any = await callWithRetry(() => sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    }));
    const sheetProp = meta.data.sheets?.find((s: any) => s.properties?.title === tableName);
    const sheetIdNum = sheetProp?.properties?.sheetId;

    if (sheetIdNum !== undefined) {
      await callWithRetry(() => sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetIdNum,
                  dimension: "ROWS",
                  startIndex: matchingRowIndex - 1, // 0-based inclusive
                  endIndex: matchingRowIndex,      // 0-based exclusive
                },
              },
            },
          ],
        },
      }));
      deletedPhysically = true;
      console.log(`[Database log: DELETE] Physically deleted row ${matchingRowIndex} in table ${tableName}. ID: ${targetId}`);
    }
  } catch (err) {
    console.error("[deleteRecord] Physical delete failed, using clear cells fallback:", err);
  }

  if (!deletedPhysically) {
    await callWithRetry(() => sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tableName}!A${matchingRowIndex}:ZZ${matchingRowIndex}`,
    }));
    console.log(`[Database log: DELETE] Cleared values of row ${matchingRowIndex} in table ${tableName}. ID: ${targetId}`);
  }

  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  } else if (upperTable === "PAROS_BOQUILLASV2") {
    delete readCache["PRODUCCIONV2"];
  }

  return true;
}

function areNozzleNewsListsEqual(listA: any[], listB: any[]): boolean {
  const arrA = Array.isArray(listA) ? listA : [];
  const arrB = Array.isArray(listB) ? listB : [];
  if (arrA.length !== arrB.length) return false;
  
  const sortedA = [...arrA].sort((a, b) => (Number(a.nozzleNumber) || 0) - (Number(b.nozzleNumber) || 0));
  const sortedB = [...arrB].sort((a, b) => (Number(a.nozzleNumber) || 0) - (Number(b.nozzleNumber) || 0));
  
  for (let i = 0; i < sortedA.length; i++) {
    const a = sortedA[i];
    const b = sortedB[i];
    if (
      Number(a.nozzleNumber) !== Number(b.nozzleNumber) ||
      String(a.startTime || "").trim() !== String(b.startTime || "").trim() ||
      String(a.endTime || "").trim() !== String(b.endTime || "").trim() ||
      Boolean(a.isAllShift) !== Boolean(b.isAllShift) ||
      String(a.observation || "").trim() !== String(b.observation || "").trim()
    ) {
      return false;
    }
  }
  return true;
}

// 10. Intelligent row-by-row reconciliation for fallback or bulk sync calls (Point 5, 8)
async function reconcileTableData(sheets: any, spreadsheetId: string, tableName: string, incomingData: any[]): Promise<void> {
  const upperTable = tableName.toUpperCase();
  delete readCache[upperTable];
  if (upperTable === "PRODUCCIONV2") {
    delete readCache["PAROS_BOQUILLASV2"];
  }

  // Ensure headers exist as reference first
  await ensureHeadersAndColumns(sheets, spreadsheetId, tableName);

  const dbData = await readTableData(sheets, spreadsheetId, tableName);
  const { clientKey } = getIdColumnAndKey(tableName);

  const dbMap = new Map<string, any>();
  dbData.forEach(item => {
    if (item && item[clientKey] !== undefined) {
      dbMap.set(String(item[clientKey]), item);
    }
  });

  const incomingMap = new Map<string, any>();
  incomingData.forEach(item => {
    if (item && item[clientKey] !== undefined) {
      incomingMap.set(String(item[clientKey]), item);
    }
  });

  // Perform surgical inserts or updates
  for (const item of incomingData) {
    if (!item) continue;
    const itemId = String(item[clientKey]);
    if (dbMap.has(itemId)) {
      const dbItem = dbMap.get(itemId);
      const schema = TABLE_SCHEMAS[upperTable];
      const headers = schema ? schema.sheetHeaders : (PREDEFINED_HEADERS[upperTable] || []);
      
      const equalBase = areRecordsEqual(item, dbItem, headers, schema);
      let equalNozzles = true;
      if (upperTable === "PRODUCCIONV2") {
        equalNozzles = areNozzleNewsListsEqual(item.nozzleNews, dbItem.nozzleNews);
      }

      if (!equalBase || !equalNozzles) {
        console.log(`[Reconciler] Item ${itemId} has changed in table ${tableName}. Modifying single row...`);
        await updateRecord(sheets, spreadsheetId, tableName, itemId, item);
      }
    } else {
      console.log(`[Reconciler] Item ${itemId} is new in table ${tableName}. Appending...`);
      await insertRecord(sheets, spreadsheetId, tableName, item);
    }
  }

  // Safely execute deletions against incoming state
  for (const dbItem of dbData) {
    if (!dbItem) continue;
    const dbId = String(dbItem[clientKey]);
    if (!incomingMap.has(dbId)) {
      console.log(`[Reconciler] Item ${dbId} is deleted in client. Triggering single row deletion...`);
      await deleteRecord(sheets, spreadsheetId, tableName, dbId);
    }
  }
}

// API Routes
app.get("/api/sheets/status", async (req, res) => {
  try {
    let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "";
    const sheetId = process.env.GOOGLE_SHEET_ID;

    // Support JSON parsing of the service account credential file for full backward compatibility
    let isJsonConfigured = false;
    try {
      if (rawKey.trim().startsWith("{")) {
        const parsed = JSON.parse(rawKey.trim());
        if (parsed && typeof parsed === "object") {
          isJsonConfigured = true;
          if (parsed.private_key) {
            rawKey = parsed.private_key;
          }
          if (parsed.client_email && !email) {
            email = parsed.client_email;
          }
        }
      }
    } catch (e) {
      // Treat as raw key
    }

    const key = rawKey;

    const diagnostics: any = {
      envVariables: {
        hasEmail: !!email,
        hasKey: !!key,
        hasSheetId: !!sheetId,
        isJsonConfigured,
      },
      keyDetails: null,
      connectionTest: null,
    };

    if (email) {
      diagnostics.emailPreview = email;
    }
    if (sheetId) {
      diagnostics.sheetIdPreview = sheetId;
    }

    if (key) {
      const rawLength = key.length;
      const cleaned = cleanPrivateKey(key);
      const cleanedLength = cleaned.length;
      const hasBegin = cleaned.includes("-----BEGIN PRIVATE KEY-----");
      const hasEnd = cleaned.includes("-----END PRIVATE KEY-----");
      const newlineCount = (cleaned.match(/\n/g) || []).length;
      
      diagnostics.keyDetails = {
        rawLength,
        cleanedLength,
        hasBeginHeader: hasBegin,
        hasEndFooter: hasEnd,
        newlineCountInCleaned: newlineCount,
        advice: "",
      };

      if (!hasBegin || !hasEnd) {
        diagnostics.keyDetails.advice = "La clave privada cargada en las variables de entorno de Vercel no tiene las cabeceras PEM estándar de Google. Debe comenzar con '-----BEGIN PRIVATE KEY-----' y terminar con '-----END PRIVATE KEY-----'. Asegúrate de que no haya faltado copiar ninguna sección.";
      } else if (newlineCount < 5) {
        diagnostics.keyDetails.advice = "La clave contiene muy pocos saltos de línea (" + newlineCount + ") en total. Generalmente, una clave JWT PEM válida de Google tiene más de 20 líneas con saltos de línea reales o representados por '\\n'. Intenta copiar la clave directa del JSON original descargado de Google";
      }
    }

    // Live Connection Dry-Run using Sheets SDK
    if (email && key && sheetId) {
      try {
        const { sheets, spreadsheetId } = getSheetsClient();
        const testRes = await callWithRetry(() => sheets.spreadsheets.get({
          spreadsheetId,
          fields: "properties.title,sheets.properties.title",
        }));
        diagnostics.connectionTest = {
          success: true,
          title: testRes.data.properties?.title || "Sin título",
          sheetsFound: testRes.data.sheets?.map((s: any) => s.properties?.title) || [],
        };
      } catch (testErr: any) {
        const errMsg = testErr.message || testErr.toString();
        let hint = "Error de conexión o autenticación con Google API.";

        if (errMsg.includes("PEM_read_bio_PrivateKey") || errMsg.includes("private key") || errMsg.includes("FormatError") || errMsg.includes("key is too short")) {
          hint = "La clave privada tiene un formato criptográfico incorrecto. Verifica que no hayas introducido espacios adicionales y que no estén duplicados los escapes. En Vercel, pega la clave completa con sus '\\n' originales.";
        } else if (errMsg.includes("invalid_grant") || errMsg.includes("signature") || errMsg.includes("JWT")) {
          hint = "Error de firma JWT (invalid_grant). El correo del Service Account y la clave privada no coinciden, o estás usando una clave de otro proyecto de Google Cloud.";
        } else if (errMsg.includes("not found") || errMsg.includes("404") || errMsg.includes("Requested entity was not found")) {
          hint = "No se encuentra el Documento de Google Sheets. El GOOGLE_SHEET_ID ingresado no existe o es incorrecto. Confírmalo mirando el ID en la URL de tu navegador.";
        } else if (errMsg.includes("permission") || errMsg.includes("403") || errMsg.includes("caller does not have permission") || errMsg.includes("unauthorized")) {
          hint = "La cuenta de servicio no tiene permisos en esta planilla. Debes ir a Google Sheets, hacer clic en 'Compartir' (Share) en la esquina superior derecha, agregar el correo '" + email + "' y asignarle el rol de editor.";
        }

        diagnostics.connectionTest = {
          success: false,
          error: errMsg,
          hint,
        };
      }
    }

    res.json({
      configured: !!(email && key && sheetId),
      email: email ? `${email.substring(0, Math.min(email.length, 12))}...` : null,
      sheetId: sheetId ? `${sheetId.substring(0, Math.min(sheetId.length, 12))}...` : null,
      hasKey: !!key,
      diagnostics
    });
  } catch (error: any) {
    console.error("Global crash in status endpoint:", error);
    // Respond with status 200 but include detailed configuration payload so page loads fine, showing diagnostic details!
    res.json({
      configured: false,
      error: error.message || error.toString(),
      stack: error.stack,
      diagnostics: {
        envVariables: {
          hasEmail: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          hasKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          hasSheetId: !!process.env.GOOGLE_SHEET_ID,
        },
        connectionTest: {
          success: false,
          error: error.message || error.toString(),
          hint: "Falla global en el servidor. Revisa si la clave privada contiene caracteres inválidos que causan errores de sintaxis en el motor de criptografía."
        }
      }
    });
  }
});

const readCache: Record<string, { timestamp: number; data: any[] }> = {};
const CACHE_TTL_MS = 6000; // Cache duration: 6 seconds to drastically reduce direct API calls

async function readTableData(sheets: any, spreadsheetId: string, table: string): Promise<any[]> {
  const upperTable = table.toUpperCase();
  const cached = readCache[upperTable];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  console.log(`[Database log: READ] Querying table '${table}' from row 1 downward to load data and audit headers concurrently.`);
  await ensureSheetExists(sheets, spreadsheetId, table);

  try {
    let rows: any[] = [];
    let headers: string[] = [];

    const schema = TABLE_SCHEMAS[upperTable];
    const expectedHeaders = schema ? schema.sheetHeaders : (PREDEFINED_HEADERS[upperTable] || []);

    const response: any = await callWithRetry(() => sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${table}!A1:ZZ50000`,
    }));

    rows = response.data.values || [];

    if (!verifiedTables.has(upperTable)) {
      const existingHeaders = rows && rows[0] ? rows[0].map((h: any) => String(h || "").trim()) : [];
      let needsHeadersFix = false;
      let finalHeaders = existingHeaders;

      if (upperTable === "PRODUCCIONV2" && existingHeaders.some(h => h.toLowerCase() === "novedades_boquillas")) {
        needsHeadersFix = true;
        finalHeaders = existingHeaders.filter(h => h.toLowerCase() !== "novedades_boquillas");
      }

      if (finalHeaders.length === 0 || finalHeaders.every(h => h === "")) {
        console.log(`[readTableData/audit] Table ${table} header is empty. Writing default headers:`, expectedHeaders);
        await callWithRetry(() => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${table}!A1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [expectedHeaders],
          },
        }));
        verifiedTables.add(upperTable);
        readCache[upperTable] = { timestamp: Date.now(), data: [] };
        return [];
      }

      const missingHeaders = expectedHeaders.filter(h => !finalHeaders.includes(h));
      if (missingHeaders.length > 0 || needsHeadersFix) {
        console.log(`[readTableData/audit] Table ${table} needs header repair or has missing columns. Repairing...`);
        const updatedHeaders = [...finalHeaders, ...missingHeaders];
        
        if (needsHeadersFix) {
          await callWithRetry(() => sheets.spreadsheets.values.clear({
            spreadsheetId,
            range: `${table}!A1:ZZ1`,
          }));
        }

        await callWithRetry(() => sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${table}!A1`,
          valueInputOption: "RAW",
          requestBody: {
            values: [updatedHeaders],
          },
        }));
        verifiedTables.add(upperTable);
        
        // Re-read once to align with the newly updated headers
        const response2: any = await callWithRetry(() => sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${table}!A1:ZZ50000`,
        }));
        rows = response2.data.values || [];
        headers = rows && rows[0] ? rows[0] : updatedHeaders;
      } else {
        verifiedTables.add(upperTable);
        headers = existingHeaders;
      }
    } else {
      headers = rows && rows[0] ? rows[0] : expectedHeaders;
    }

    if (!rows || rows.length < 1) {
      readCache[upperTable] = { timestamp: Date.now(), data: [] };
      return [];
    }

    const dataRows = rows.slice(1);

    const list = dataRows.map((row) => {
      return parseRowToClientObject(headers, row, table);
    }).filter((item) => item !== null);

    if (upperTable === "PRODUCCIONV2") {
      await enrichProductionReportsWithNozzleNews(sheets, spreadsheetId, list);
    }

    if (upperTable === "PAROSV2") {
      await enrichParosOnRead(sheets, spreadsheetId, list);
    }

    readCache[upperTable] = { timestamp: Date.now(), data: list };
    return list;
  } catch (readError: any) {
    if (readError.message?.includes("range")) {
      readCache[upperTable] = { timestamp: Date.now(), data: [] };
      return [];
    }
    throw readError;
  }
}

async function enrichProductionReportsWithNozzleNews(sheets: any, spreadsheetId: string, list: any[]) {
  try {
    const nozzleList = await readTableData(sheets, spreadsheetId, "PAROS_BOQUILLASV2");
    list.forEach((item: any) => {
      item.nozzleNews = nozzleList.filter((n: any) => n.productionId === item.id);
    });
  } catch (err) {
    console.error("Error fetching PAROS_BOQUILLASV2 on read:", err);
    list.forEach((item: any) => {
      item.nozzleNews = [];
    });
  }
}

async function enrichParosOnRead(sheets: any, spreadsheetId: string, list: any[]) {
  try {
    const [shifts, palletizers, baggers, hacs, materials, causes] = await Promise.all([
      readTableData(sheets, spreadsheetId, "TURNOSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "PALETIZADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "ENSACADORAV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "HACSV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "MATERIALESV2").catch(() => []),
      readTableData(sheets, spreadsheetId, "CAUSASV2").catch(() => []),
    ]);

    list.forEach((item: any) => {
      // 1. Shift
      const shift = shifts.find((s: any) => s.name === item.shiftName);
      if (shift) {
        item.shiftId = shift.id;
      } else {
        item.shiftId = item.shiftName || "";
      }

      // 2. Machine Affected (Palletizer / Bagger)
      const allMachines = [...palletizers, ...baggers];
      const pal = allMachines.find((p: any) => 
        (p.id && String(p.id).toUpperCase() === String(item.machineHacText).toUpperCase()) || 
        (p.name && String(p.name).toUpperCase() === String(item.machineHacText).toUpperCase()) ||
        (p.nombre && String(p.nombre).toUpperCase() === String(item.machineHacText).toUpperCase())
      );

      if (pal) {
        item.machineId = pal.id;
        item.machineName = pal.name || pal.nombre || "";
      } else {
        // Find if item.machineHacText represents a HAC code
        const hacForPal = hacs.find((h: any) => h.hac && String(h.hac).toUpperCase() === String(item.machineHacText).toUpperCase());
        if (hacForPal) {
          const matchedPal = allMachines.find((p: any) => 
            p.hacId === hacForPal.id || 
            p.hacId === hacForPal.hac || 
            p.hac_id === hacForPal.id || 
            p.hac_id === hacForPal.hac
          );
          if (matchedPal) {
            item.machineId = matchedPal.id;
            item.machineName = matchedPal.name || matchedPal.nombre || "";
          } else {
            item.machineId = item.machineHacText || "";
            item.machineName = item.machineHacText || "";
          }
        } else {
          item.machineId = item.machineHacText || "";
          item.machineName = item.machineHacText || "";
        }
      }

      // 3. Material
      const mat = materials.find((m: any) => m.name === item.materialDescription);
      if (mat) {
        item.materialId = mat.id;
      } else {
        item.materialId = item.materialDescription || "";
      }

      // 4. HAC
      const hacObj = hacs.find((h: any) => h.hac === item.hacName);
      if (hacObj) {
        item.hacId = hacObj.id;
      } else {
        item.hacId = item.hacName || "";
      }

      // 5. Cause
      const causeObj = causes.find((c: any) => c.text === item.causeText || c.descripcion === item.causeText);
      if (causeObj) {
        item.causeId = causeObj.id;
      } else {
        item.causeId = item.causeText || "";
      }

      // 6. durationMinutes
      item.durationMinutes = durationMinutesFromHHMMSS(item.durationTime);

      // 7. Format time for Form (HH:mm)
      if (item.startTime && item.startTime.length === 8) {
        item.startTime = item.startTime.slice(0, 5);
      }
      if (item.endTime && item.endTime.length === 8) {
        item.endTime = item.endTime.slice(0, 5);
      }
    });

  } catch (err) {
    console.error("Error enriching PAROSV2 on read:", err);
  }
}

// GET Endpoint to read table
app.get("/api/sheets", async (req, res) => {
  const table = req.query.table as string;
  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  try {
    const { sheets, spreadsheetId } = getSheetsClient();
    const list = await readTableData(sheets, spreadsheetId, table);
    return res.json({ success: true, data: list });
  } catch (error: any) {
    console.error(`Error reading sheet ${table}:`, error);
    return res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// POST Endpoint to read/write tables
app.post("/api/sheets", async (req, res) => {
  const { action, table, data } = req.body;

  if (!table) {
    return res.status(400).json({ success: false, error: "Falta el parámetro 'table'" });
  }

  try {
    const { sheets, spreadsheetId } = getSheetsClient();

    // Handle READ action via POST
    if (action === "read") {
      try {
        const list = await readTableData(sheets, spreadsheetId, table);
        return res.json({ success: true, data: list });
      } catch (error: any) {
        console.error(`Error reading sheet via POST ${table}:`, error);
        return res.status(500).json({ success: false, error: error.message || error.toString() });
      }
    }

    // Handle WRITE action (backward compatible, now safe reconciliation)
    if (action === "write") {
      try {
        if (!data) {
          return res.status(400).json({ success: false, error: "Faltan los datos para la acción write" });
        }
        await reconcileTableData(sheets, spreadsheetId, table, data);
        if (table === "PAROSV2") {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, count: data.length });
      } catch (error: any) {
        console.error(`Error in reconciled write action for ${table}:`, error);
        return res.status(500).json({ success: false, error: error.message || error.toString() });
      }
    }

    // Handle CREATE action
    if (action === "create") {
      try {
        const { item } = req.body;
        if (!item) {
          return res.status(400).json({ success: false, error: "Falta el parámetro 'item' para crear" });
        }
        await insertRecord(sheets, spreadsheetId, table, item);
        if (table === "PAROSV2") {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, message: "Registro guardado con éxito" });
      } catch (error: any) {
        console.error(`Error in create action for ${table}:`, error);
        return res.status(500).json({ success: false, error: error.message || error.toString() });
      }
    }

    // Handle UPDATE action
    if (action === "update") {
      try {
        const { id, item } = req.body;
        if (id === undefined || !item) {
          return res.status(400).json({ success: false, error: "Faltan 'id' o 'item' para actualizar" });
        }
        await updateRecord(sheets, spreadsheetId, table, id, item);
        if (table === "PAROSV2") {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, message: "Registro actualizado con éxito" });
      } catch (error: any) {
        console.error(`Error in update action for ${table}:`, error);
        return res.status(500).json({ success: false, error: error.message || error.toString() });
      }
    }

    // Handle DELETE action
    if (action === "delete") {
      try {
        const { id } = req.body;
        if (id === undefined) {
          return res.status(400).json({ success: false, error: "Falta el parámetro 'id' para eliminar" });
        }
        const isDeleted = await deleteRecord(sheets, spreadsheetId, table, id);
        if (table === "PAROSV2" && isDeleted) {
          await autoRecalculateProductionMetrics(sheets, spreadsheetId);
        }
        return res.json({ success: true, message: isDeleted ? "Registro eliminado con éxito" : "Registro no encontrado para eliminar" });
      } catch (error: any) {
        console.error(`Error in delete action for ${table}:`, error);
        return res.status(500).json({ success: false, error: error.message || error.toString() });
      }
    }

    return res.status(400).json({ success: false, error: `Acción inválida: ${action}` });
  } catch (error: any) {
    console.error(`Error in sheets action for ${table}:`, error);
    return res.status(500).json({ success: false, error: error.message || error.toString() });
  }
});

// Vite Setup & Routing
async function startServer() {
  if (process.env.VERCEL) {
    console.log("Running in Vercel serverless environment. Dynamic port listening is bypassed.");
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully operational on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
