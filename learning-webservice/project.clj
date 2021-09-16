(defproject learning-webservice "0.0.1-SNAPSHOT"
  :description "A webservice providing convenient access to the language learning resources"
  :url "TODO"
  :license {:name "MIT"}
  :dependencies [[org.clojure/clojure "1.10.1"]
                 [io.pedestal/pedestal.service "0.5.9"]

                 ;; Remove this line and uncomment one of the next lines to
                 ;; use Immutant or Tomcat instead of Jetty:
                 [io.pedestal/pedestal.jetty "0.5.9"]
                 ;; [io.pedestal/pedestal.immutant "0.5.9"]
                 ;; [io.pedestal/pedestal.tomcat "0.5.9"]

                 [ch.qos.logback/logback-classic "1.2.3" :exclusions [org.slf4j/slf4j-api]]
                 [org.slf4j/jul-to-slf4j "1.7.26"]
                 [org.slf4j/jcl-over-slf4j "1.7.26"]
                 [org.slf4j/log4j-over-slf4j "1.7.26"]]
  :min-lein-version "2.0.0"
  :resource-paths ["config", "resources"]
  ;; If you use HTTP/2 or ALPN, use the java-agent to pull in the correct alpn-boot dependency
  ;:java-agents [[org.mortbay.jetty.alpn/jetty-alpn-agent "2.0.5"]]
  :profiles {:dev {:aliases {"run-dev" ["trampoline" "run" "-m" "learning-webservice.server/run-dev"]}
                   :dependencies [[io.pedestal/pedestal.service-tools "0.5.9"]]}
             :uberjar {:aot [learning-webservice.server]}}
  :main ^{:skip-aot true} learning-webservice.server)
