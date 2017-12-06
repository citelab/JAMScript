FROM ubuntu
RUN apt-get update && apt-get install -y wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim
RUN git clone https://github.com/anrl/JAMScript-beta && cd JAMScript-beta/scripts/install && cp jamscript-on-docker.sh ../..  && cp depend-docker.sh ../.. && cp avahi-daemon.conf ../.. && cd ../..  && ./depend-docker.sh && ./jamscript-on-docker.sh
CMD chmod -R a+Xr /etc/avahi && cp avahi-daemon.conf /etc/avahi/ && cd /var/run/ && rm -rf dbus && mkdir dbus && dbus-daemon --system &&  avahi-daemon
