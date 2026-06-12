import { Router } from "express";
import { google } from "googleapis";
import { AuthService } from "../services/auth.service.js";

const router = Router();

// Retrieve Supabase Public Credentials configuration for Client Sign-In
router.get("/api/auth/supabase/config", (req, res) => {
  return res.json({
    success: true,
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  });
});

// Generate Google OAuth Authorization URL
router.get("/api/auth/google/url", (req, res) => {
  const customRedirect = req.query.redirectUri as string;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      success: false,
      error: "Google OAuth credentials are not configured on the server. Please define GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in environment settings."
    });
  }

  const redirectUri = customRedirect || `${req.protocol}://${req.get("host")}/auth/callback`;

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
    prompt: "consent"
  });

  return res.json({ success: true, url });
});

// OAuth Callback exchange, verifying user in USUARIOSV2
router.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  const customRedirect = req.query.redirectUri as string;
  const redirectUri = customRedirect || `${req.protocol}://${req.get("host")}/auth/callback`;

  if (!code) {
    return res.status(400).send("No authorization code provided by Google OAuth.");
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).send("Google OAuth is not configured on the server. Please define GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.");
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfoRes = await oauth2.userinfo.get();
    const googleEmail = userInfoRes.data.email;
    const googleName = userInfoRes.data.name;

    if (!googleEmail) {
      return res.status(400).send("No se pudo obtener la dirección de correo electrónico de la cuenta de Google.");
    }

    // Validate email using AuthService
    const matchedUser = await AuthService.validateUserEmail(googleEmail);

    if (!matchedUser) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="es">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Acceso no autorizado - PSCQUBE</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
              body { font-family: 'Inter', sans-serif; }
            </style>
          </head>
          <body class="bg-[#0b0f19] text-gray-200 min-h-screen flex items-center justify-center p-6">
            <div class="max-w-md w-full bg-[#151c2c] border border-red-500/20 rounded-2xl p-8 text-center shadow-2xl">
              <div class="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h1 class="text-2xl font-bold text-white mb-2">Acceso No Autorizado</h1>
              <p class="text-sm text-gray-400 mb-6 font-medium leading-relaxed">
                La dirección de correo electrónico <strong class="text-red-400 font-semibold">${googleEmail}</strong> no está registrada como usuario habilitado en el sistema <strong>PSCQUBE</strong>.
              </p>
              <div class="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 text-left mb-6 text-xs text-yellow-300/90 leading-relaxed font-mono">
                Póngase en contacto con el Super Usuario o Administrador del sistema para que registre este correo en las columnas email o email2 de la tabla "usuariosv2".
              </div>
              <button onclick="cerrarVentana()" class="w-full bg-[#1b2234] hover:bg-[#232c42] text-white py-3 px-4 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary">
                Cerrar e Intentar de Nuevo
              </button>
            </div>
            <script>
              function cerrarVentana() {
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_ERROR', 
                    error: 'Correo no autorizado',
                    detail: 'El correo ${googleEmail} no está registrado en la base de datos de usuarios (usuariosv2).'
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }
            </script>
          </body>
        </html>
      `);
    }

    // Success login page payload
    return res.send(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Autenticación exitosa - PSCQUBE</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; }
          </style>
        </head>
        <body class="bg-[#0b0f19] text-gray-200 min-h-screen flex items-center justify-center p-6 font-sans">
          <div class="max-w-md w-full bg-[#151c2c] border border-emerald-500/20 rounded-2xl p-8 text-center shadow-2xl">
            <div class="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-8 h-8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-white mb-2">Ingreso Autorizado</h1>
            <p class="text-sm text-gray-400 mb-6 font-medium">
              ¡Bienvenido, <strong class="text-emerald-400 font-bold">${matchedUser.nombre || matchedUser.name || googleName}</strong>! Has ingresado correctamente.
            </p>
            <p class="text-xs text-gray-500 animate-pulse">Esta ventana se cerrará automáticamente.</p>
          </div>
          <script>
            const matchedUserObj = ${JSON.stringify(matchedUser)};
            
            if (matchedUserObj.nombre && !matchedUserObj.name) matchedUserObj.name = matchedUserObj.nombre;
            if (matchedUserObj.usuariosap && !matchedUserObj.sapUser) matchedUserObj.sapUser = matchedUserObj.usuariosap;
            if (matchedUserObj.puesto && !matchedUserObj.position) matchedUserObj.position = matchedUserObj.puesto;
            if (matchedUserObj.perfil && !matchedUserObj.profile) matchedUserObj.profile = matchedUserObj.perfil;
            if (matchedUserObj.permisos && !matchedUserObj.permissions) matchedUserObj.permissions = matchedUserObj.permisos;

            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                user: matchedUserObj,
                googleEmail: "${googleEmail}"
              }, '*');
              window.close();
            } else {
              sessionStorage.setItem('pscqube_user', JSON.stringify(matchedUserObj));
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("[Google OAuth Callback Error]", error);
    return res.status(500).send(`Error de inicio de sesión de Google: ${error.message || error.toString()}`);
  }
});

export default router;
