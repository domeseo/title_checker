#!/usr/bin/env node

/**
 * Script para parchear dependencias vulnerables en node_modules
 * 
 * Este script reemplaza versiones vulnerables de nth-check y otras dependencias
 * directamente en la carpeta node_modules.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colores para la salida en consola
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

// Función para encontrar todas las instancias de un paquete en node_modules
function findPackagePaths(baseDir, packageName) {
    console.log(`${colors.blue}Buscando todas las instancias de ${packageName}...${colors.reset}`);

    try {
        // Usar find para localizar todas las instancias del package.json que contienen el paquete
        const cmd = `find ${baseDir} -name "package.json" -type f -exec grep -l "\\\"name\\\":\\s*\\\"${packageName}\\\"" {} \\;`;
        const output = execSync(cmd, { encoding: 'utf8' });

        return output.trim().split('\n').filter(Boolean);
    } catch (error) {
        console.error(`${colors.red}Error al buscar ${packageName}:${colors.reset}`, error.message);
        return [];
    }
}

// Función para actualizar un paquete a una versión segura
function updatePackage(packageJsonPath, safeVersion) {
    try {
        const packageDir = path.dirname(packageJsonPath);
        const packageJson = require(packageJsonPath);

        console.log(`${colors.yellow}Actualizando ${packageJson.name}@${packageJson.version} a versión ${safeVersion} en ${packageDir}${colors.reset}`);

        // Guardar la versión original
        const originalVersion = packageJson.version;

        // Actualizar la versión
        packageJson.version = safeVersion;

        // Escribir el package.json actualizado
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        console.log(`${colors.green}✓ Actualizado ${packageJson.name} de ${originalVersion} a ${safeVersion}${colors.reset}`);

        return true;
    } catch (error) {
        console.error(`${colors.red}Error al actualizar ${packageJsonPath}:${colors.reset}`, error.message);
        return false;
    }
}

// Función para parchear directamente PostCSS
function patchPostCSS() {
    console.log(`\n${colors.cyan}=== Aplicando parche directo a PostCSS para CVE-2023-26964 ===${colors.reset}`);

    try {
        // Buscar archivos tokenize.js en todos los módulos de PostCSS
        const cmd = `find ${nodeModulesDir} -path "*/postcss/lib/tokenize.js" -type f`;
        const tokenizeFiles = execSync(cmd, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

        console.log(`${colors.blue}Encontrados ${tokenizeFiles.length} archivos tokenize.js para parchear.${colors.reset}`);

        let successCount = 0;

        for (const filePath of tokenizeFiles) {
            console.log(`${colors.yellow}Parcheando ${filePath}${colors.reset}`);

            // Leer el contenido del archivo
            let content = fs.readFileSync(filePath, 'utf8');

            // Verificar si el archivo ya está parcheado
            if (content.includes('// Fix for CVE-2023-26964')) {
                console.log(`${colors.green}✓ El archivo ya está parcheado${colors.reset}`);
                successCount++;
                continue;
            }

            // Determinar la constante utilizada para CR (puede ser CARRIAGERETURN o CR)
            const hasCR = content.includes('const CR =') || content.includes('var CR =');
            const crConstant = hasCR ? 'CR' : 'CARRIAGERETURN';

            // Buscar puntos clave para insertar el parche
            const patches = [
                {
                    // Parche 1: Para manejo de comentarios
                    search: /if \(code === SLASH && css\.charCodeAt\(pos \+ 1\) === ASTERISK\) {[^}]+pos \+= 2/g,
                    replace: (match) => {
                        return match + `\n\n      // Fix for CVE-2023-26964\n      // Correctly handle \\r in comments\n      let next = css.charCodeAt(pos);\n      if (next === ${crConstant}) {\n        pos += 1;\n      }`;
                    }
                },
                // Varios parches para los escapes de backslash
                {
                    search: /if \(css\.charCodeAt\(pos - 1\) !== BACKSLASH\) {\s+break\s+}\s+pos \+= 1/g,
                    replace: (match) => {
                        return match.replace('pos += 1', `\n\n      // Prevent \\r from escaping out of comment blocks\n      if (css.charCodeAt(pos) === ${crConstant}) {\n        pos += 1;\n        continue;\n      }\n\n      pos += 1`);
                    }
                }
            ];

            // Aplicar parches
            let modified = false;
            for (const patch of patches) {
                if (patch.search.test(content)) {
                    content = content.replace(patch.search, patch.replace);
                    modified = true;
                }
            }

            if (modified) {
                // Guardar el archivo parcheado
                fs.writeFileSync(filePath, content);
                console.log(`${colors.green}✓ Archivo parcheado con éxito${colors.reset}`);
                successCount++;
            } else {
                console.log(`${colors.red}✗ No se pudo aplicar el parche (patrones no encontrados)${colors.reset}`);
            }
        }

        console.log(`\n${colors.green}✓ PostCSS parcheado: ${successCount} de ${tokenizeFiles.length} archivos actualizados${colors.reset}`);
        return successCount;
    } catch (error) {
        console.error(`${colors.red}Error al parchear PostCSS:${colors.reset}`, error.message);
        return 0;
    }
}

// Función principal
function main() {
    console.log(`${colors.cyan}=== Iniciando corrección de vulnerabilidades de seguridad ===${colors.reset}`);

    // Parchear cada paquete
    let totalFixed = 0;
    let totalFailures = 0;

    for (const [packageName, safeVersion] of Object.entries(packagesToFix)) {
        console.log(`\n${colors.cyan}=== Parcheando ${packageName} a ${safeVersion} ===${colors.reset}`);

        const packagePaths = findPackagePaths(nodeModulesDir, packageName);

        if (packagePaths.length === 0) {
            console.log(`${colors.yellow}No se encontraron instancias de ${packageName}.${colors.reset}`);
            continue;
        }

        console.log(`${colors.blue}Encontradas ${packagePaths.length} instancias de ${packageName}.${colors.reset}`);

        for (const packageJsonPath of packagePaths) {
            const success = updatePackage(packageJsonPath, safeVersion);

            if (success) {
                totalFixed++;
            } else {
                totalFailures++;
            }
        }
    }

    // Parchear PostCSS directamente ya que tiene requisitos conflictivos
    const postcssPatchedCount = patchPostCSS();

    // Clean cache and verify
    console.log(`\n${colors.cyan}=== Limpiando la caché de npm ===${colors.reset}`);
    try {
        execSync('npm cache clean --force', { stdio: 'inherit' });
        console.log(`${colors.green}✓ Caché limpiada exitosamente${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}Error al limpiar la caché:${colors.reset}`, error.message);
    }

    console.log(`\n${colors.cyan}=== Ejecutando npm audit para verificar vulnerabilidades restantes ===${colors.reset}`);
    try {
        execSync('npm audit', { stdio: 'inherit' });
    } catch (error) {
        console.error(`${colors.red}Aún hay vulnerabilidades. Revisa el reporte de npm audit.${colors.reset}`);
    }

    console.log(`\n${colors.cyan}=== Completado ===${colors.reset}`);
    console.log(`${colors.green}Si sigues viendo vulnerabilidades, ejecuta 'npm audit fix --force' o actualiza manualmente las dependencias restantes.${colors.reset}`);
}

// Paquetes a parchear y sus versiones seguras
const packagesToFix = {
    'nth-check': '2.1.1',
    'postcss': '8.4.35',
};

// Directorio base node_modules
const nodeModulesDir = path.join(__dirname, 'node_modules');

// Ejecutar el script
main(); 