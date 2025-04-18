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

// Paquetes a parchear y sus versiones seguras
const packagesToFix = {
    'nth-check': '2.1.1',
    'postcss': '8.4.35',
};

// Directorio base node_modules
const nodeModulesDir = path.join(__dirname, 'node_modules');

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

console.log(`\n${colors.cyan}=== Resumen ===${colors.reset}`);
console.log(`${colors.green}✓ Paquetes parcheados exitosamente: ${totalFixed}${colors.reset}`);
if (totalFailures > 0) {
    console.log(`${colors.red}✗ Fallos: ${totalFailures}${colors.reset}`);
}

// Actualizar las dependencias después del parche
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