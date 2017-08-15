FROM ubuntu
RUN apt-get update && apt-get install -y wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim
RUN git clone https://github.com/anrl/JAMScript-beta && cd JAMScript-beta/scripts/install && cp jamscript-on-doc
ker.sh ../..  && cp depend-docker.sh ../.. && cd ../..  && ./depend-docker.sh && ./jamscript-on-docker.sh
CMD cd /var/run/ && rm -rf dbus && mkdir dbus && dbus-daemon --system && avahi-daemon
