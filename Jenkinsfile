pipeline {
    agent {
        kubernetes {
            inheritFrom 'ejercicio-1'
            defaultContainer 'docker-cli'
        }
    }

    parameters {
        string(name: 'IMAGE_NAME', defaultValue: 'docker.io/idalilc/tecnico-node:1.0.0', trim: true,
               description: 'Referencia completa de la imagen de Docker Hub')
        string(name: 'NAMESPACE', defaultValue: 'tecnico-node', trim: true,
               description: 'Namespace de Kubernetes que ya existe')
    }

    environment {
        APP_NAME = 'tecnico-node'
        KUBECTL_VERSION = 'v1.37.1'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Deploy') {
            steps {
                container('docker-cli') {
                    withCredentials([usernamePassword(credentialsId: 'container-registry-push',
                                                      usernameVariable: 'DOCKERHUB_USER',
                                                      passwordVariable: 'DOCKERHUB_TOKEN')]) {
                        sh '''
                        set -eu
                        export PATH="$WORKSPACE/.tools:$PATH"
                        set -o pipefail
                        if [ -z "$IMAGE_NAME" ]; then
                            echo "IMAGE_NAME no puede estar vacío" >&2
                            exit 1
                        fi
                        if ! printf '%s' "$IMAGE_NAME" | grep -Eq '^[a-z0-9][a-z0-9./:_@-]{1,254}$'; then
                            echo "IMAGE_NAME contiene caracteres no válidos" >&2
                            exit 1
                        fi
                        if ! printf '%s' "$NAMESPACE" | grep -Eq '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$' || [ "${#NAMESPACE}" -gt 63 ]; then
                            echo "NAMESPACE debe ser un nombre DNS de Kubernetes de hasta 63 caracteres" >&2
                            exit 1
                        fi

                        mkdir -p "$WORKSPACE/.tools"
                        if [ ! -x "$WORKSPACE/.tools/kubectl" ]; then
                            apk add --no-cache ca-certificates curl
                            case "$(uname -m)" in
                                x86_64) arch=amd64 ;;
                                aarch64) arch=arm64 ;;
                                *) echo "Arquitectura no soportada: $(uname -m)" >&2; exit 1 ;;
                            esac
                            curl --fail --location --silent --show-error \
                                --output "$WORKSPACE/.tools/kubectl" \
                                "https://dl.k8s.io/$KUBECTL_VERSION/bin/linux/$arch/kubectl"
                            curl --fail --location --silent --show-error \
                                --output "$WORKSPACE/.tools/kubectl.sha256" \
                                "https://dl.k8s.io/$KUBECTL_VERSION/bin/linux/$arch/kubectl.sha256"
                            printf '%s  %s\n' "$(cat "$WORKSPACE/.tools/kubectl.sha256")" "$WORKSPACE/.tools/kubectl" | sha256sum -c -
                            chmod 0755 "$WORKSPACE/.tools/kubectl"
                            rm "$WORKSPACE/.tools/kubectl.sha256"
                        fi

                        kubectl get namespace "$NAMESPACE" >/dev/null
                        docker_config="$(mktemp -d)"
                        trap 'rm -rf "$docker_config"' EXIT
                        export DOCKER_CONFIG="$docker_config"
                        printf '%s' "$DOCKERHUB_TOKEN" | docker login docker.io \
                            --username "$DOCKERHUB_USER" --password-stdin
                        kubectl create secret generic dockerhub-pull \
                            --namespace "$NAMESPACE" \
                            --from-file=.dockerconfigjson="$DOCKER_CONFIG/config.json" \
                            --type=kubernetes.io/dockerconfigjson \
                            --dry-run=client -o yaml | kubectl apply -f -
                        sed "s|__IMAGE_NAME__|$IMAGE_NAME|g" k8s/deployment.yaml > "$WORKSPACE/.rendered.yaml"
                        kubectl apply --namespace "$NAMESPACE" --filename "$WORKSPACE/.rendered.yaml"
                        kubectl rollout status deployment/tecnico-node --namespace "$NAMESPACE" --timeout=180s
                        '''
                    }
                }
            }
        }

        stage('Port forward') {
            steps {
                container('docker-cli') {
                    sh '''
                        set -eu
                        export PATH="$WORKSPACE/.tools:$PATH"
                        kubectl port-forward --address 127.0.0.1 \
                            --namespace "$NAMESPACE" service/tecnico-node 18080:80 \
                            > "$WORKSPACE/port-forward.log" 2>&1 &
                        port_forward_pid=$!
                        trap 'kill "$port_forward_pid" 2>/dev/null || true' EXIT

                        attempt=0
                        until response="$(wget -qO- http://127.0.0.1:18080/healthz)"; do
                            attempt=$((attempt + 1))
                            if [ "$attempt" -ge 30 ] || ! kill -0 "$port_forward_pid" 2>/dev/null; then
                                cat "$WORKSPACE/port-forward.log" >&2
                                echo "No se pudo comprobar /healthz a través del port-forward" >&2
                                exit 1
                            fi
                            sleep 1
                        done
                        printf '%s\n' "$response"
                        case "$response" in
                            *'"status":"ok"'*) echo "PASS: port-forward y endpoint de salud" ;;
                            *) echo "Respuesta inesperada: $response" >&2; exit 1 ;;
                        esac
                    '''
                }
            }
        }
    }
}
