pipeline {
  agent none

  environment {
    SONAR_TOKEN = credentials('SONAR_TOKEN')
    SNYK_TOKEN  = credentials('SNYK_TOKEN')
    DOCKER_IMAGE = "nodegoat:${env.BUILD_NUMBER}"
    MONGO_IMAGE = "mongo:4.4"
    APP_PORT = "4000"
    NETWORK_NAME = "nodegoat-net"
  }

  stages {

    stage('Checkout') {
      agent any
      steps {
        checkout scm
      }
    }
  }

  post {
    always {
      agent any
      sh '''
        docker rm -f nodegoat-app || true
        docker rm -f nodegoat-mongo || true
        docker network rm ${NETWORK_NAME} || true
        docker rmi -f ${DOCKER_IMAGE} || true
      '''
    }
  }
}
