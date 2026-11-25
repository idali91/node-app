# Ejercicio 2 — aplicación Node.js en Alpine

Esta carpeta contiene una API Node.js mínima, su imagen de Docker y una pipeline Jenkins para desplegarla en Kubernetes. Node.js ejecuta JavaScript directamente; esta variante no necesita Java ni una etapa de compilación. La variante Java del ejercicio muestra la compilación con Maven y JDK.

## Recorrido rápido

1. Construye y publica `docker.io/<usuario>/tecnico-node:1.0.0` en Docker Hub.
2. Crea el secret `dockerhub-pull` en el namespace de destino.
3. Configura un job Jenkins Pipeline que apunte a este repositorio y ejecuta la pipeline con `IMAGE_NAME` y `NAMESPACE`.

La pipeline contiene los stages Checkout, Deploy y Port forward. El último abre un túnel temporal dentro del agente Jenkins y consulta `/healthz`; el túnel se cierra al terminar el stage.

## Imagen

```sh
docker build --pull -t docker.io/<usuario>/tecnico-node:1.0.0 .
docker push docker.io/<usuario>/tecnico-node:1.0.0
```

La imagen parte de `node:22-alpine`, copia solo los archivos de la app y ejecuta como el usuario sin privilegios `node`.

## Secret de Docker Hub

El secret debe existir en el mismo namespace que recibirá el Deployment. Usa un token de acceso de Docker Hub con permiso de lectura. Evita guardar el token en Git o escribirlo directamente en el historial del shell.

```sh
set -eu
set -o pipefail
export DOCKERHUB_USER='<usuario>'
export K8S_NAMESPACE='tecnico-node'
DOCKER_CONFIG="$(mktemp -d)"
export DOCKER_CONFIG
trap 'rm -rf "$DOCKER_CONFIG"' EXIT
docker login --username "$DOCKERHUB_USER"
kubectl create namespace "$K8S_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic dockerhub-pull \
  --namespace "$K8S_NAMESPACE" \
  --from-file=.dockerconfigjson="$DOCKER_CONFIG/config.json" \
  --type=kubernetes.io/dockerconfigjson \
  --dry-run=client -o yaml | kubectl apply -f -
unset DOCKERHUB_TOKEN
```

## Jenkins y Kubernetes

- La pipeline hereda la plantilla global `ejercicio-1` y ejecuta `kubectl` desde el contenedor `docker-cli`.
- El agente debe tener acceso a la API de Kubernetes y RBAC para leer namespaces y secrets, aplicar Deployments y Services, consultar rollout y abrir port-forward.
- El namespace debe existir y contener `dockerhub-pull` antes del despliegue.
- `IMAGE_NAME` debe ser una referencia completa, por ejemplo `docker.io/<usuario>/tecnico-node:1.0.0`.
- `NAMESPACE` debe ser un namespace existente.
- Se instala `kubectl` v1.37.1 en el agente con verificación SHA-256. Ajusta la versión para que sea compatible con el clúster.
- `k8s/deployment.yaml` contiene un Deployment con probes y límites de recursos, y un Service interno.

El port-forward de la pipeline solo sirve para la comprobación desde Jenkins. Para acceder desde tu equipo, ejecuta localmente:

```sh
kubectl port-forward --namespace tecnico-node service/tecnico-node 18080:80
```

Después abre `http://127.0.0.1:18080/` o `http://127.0.0.1:18080/healthz`.
