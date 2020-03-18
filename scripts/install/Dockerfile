FROM ubuntu
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils && \
        apt-get install -y -q wget \
        build-essential \
        python \
        unzip \
        libbsd-dev \
        git \
        sudo \
        vim \
        curl \
        libssl-dev \
        cmake \
        iproute2 \
        net-tools \
        iputils-ping \
        inotify-tools

RUN useradd -m admin && echo "admin:admin" | chpasswd && adduser admin sudo
RUN echo "admin ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers
USER admin
WORKDIR /home/admin
RUN wget https://deb.nodesource.com/setup_13.x && chmod +x ./setup_13.x && echo admin | sudo -S ./setup_13.x && \
        sudo apt-get install -y -q nodejs

RUN git clone https://github.com/citelab/JAMScript 

RUN mkdir ~/.npm-global && npm config set prefix '~/.npm-global'

WORKDIR /home/admin/JAMScript
RUN npm run link
ENV PATH="/home/admin/.npm-global/bin:$PATH"
RUN mkdir /home/admin/temp
WORKDIR /home/admin/temp

CMD sudo chmod -R a+Xr /etc/avahi && sudo sed -i "s|rlimit-nproc=3|#rlimit-nproc=3 |g" /etc/avahi/avahi-daemon.conf && sudo chmod -R a+Xr /var/run && cd /var/run/ && sudo rm -rf dbus && sudo mkdir dbus && sudo dbus-daemon --system &&  sudo avahi-daemon
