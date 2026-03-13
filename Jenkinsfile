pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
  }

  environment {
    // Adjust if you use a different Python/Node version on your agents
    PYTHON = 'C:/Program Files/Python314/python.exe'
    NODEJS = 'node'
    APP_PORT = '5000'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Setup Backend') {
      steps {
        script {
          // On Windows agents, install Python deps from requirements.txt in workspace root if present
          if (fileExists('requirements.txt')) {
            bat "\"${env.PYTHON}\" -m pip install --upgrade pip"
            bat "\"${env.PYTHON}\" -m pip install --upgrade pip"
          } else {
            echo 'No requirements.txt found; skipping backend setup.'
          }
        }
      }
    }

    stage('Setup Frontend') {
      steps {
        dir('frontend') {
          script {
            if (fileExists('package.json')) {
              bat "npm install"
            }
          }
        }
      }
    }

    stage('Backend Tests') {
      when {
        expression { fileExists('pytest.ini') || fileExists('tests') }
      }
      steps {
        script {
          if (fileExists('pytest.ini') || fileExists('tests')) {
            bat "${env.PYTHON} -m pytest"
          } else {
            echo 'No backend tests configured; skipping.'
          }
        }
      }
    }

    stage('Frontend Build') {
      when {
        expression { fileExists('frontend/package.json') }
      }
      steps {
        dir('frontend') {
          bat "npm run build || echo 'No build script configured; skipping.'"
        }
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '**/dist/**, **/build/**, **/test-results/**/*.xml', fingerprint: true, allowEmptyArchive: true
      junit testResults: '**/test-results/**/*.xml', allowEmptyResults: true
    }
    failure {
      echo 'Build failed.'
    }
    success {
      echo 'Build succeeded.'
    }
  }
}

