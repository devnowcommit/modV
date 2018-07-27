import store from '@/../store';

class WindowController {
  constructor(Vue) {
    return new Promise((resolve) => {
      if (window.nw) {
        if (window.nw.open) {
          window.nw.Window.open('output.html', (newWindow) => {
            this.window = newWindow.window;
            if (this.window.document.readyState === 'complete') {
              this.configureWindow(resolve);
            } else {
              this.window.onload = () => {
                this.configureWindow(resolve);
              };
            }
          });
        } else {
          this.window = window.open(
            '',
            '_blank',
            'width=250, height=250, location=no, menubar=no, left=0',
          );

          if (this.window === null || typeof this.window === 'undefined') {
            Vue.$dialog.alert({
              title: 'Could not create Output Window',
              message: 'modV couldn\'t open an Output Window. Please check you\'ve allowed pop-ups - then reload',
              type: 'is-danger',
              hasIcon: true,
              icon: 'times-circle',
              iconPack: 'fa',
            });
            return;
          }

          if (this.window.document.readyState === 'complete') {
            this.configureWindow(resolve);
          } else {
            this.window.onload = () => {
              this.configureWindow(resolve);
            };
          }
        }
      }
    });
  }


  configureWindow(callback) {
    const windowRef = this.window;
    windowRef.document.title = 'modV Output';
    windowRef.document.body.style.margin = '0px';
    windowRef.document.body.style.backgroundColor = 'black';

    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');

    this.canvas.style.backgroundColor = 'transparent';

    this.canvas.addEventListener('dblclick', () => {
      if (!this.canvas.ownerDocument.webkitFullscreenElement) {
        this.canvas.webkitRequestFullscreen();
      } else {
        this.canvas.ownerDocument.webkitExitFullscreen();
      }
    });

    let mouseTimer;

    function movedMouse() {
      if (mouseTimer) mouseTimer = null;
      this.canvas.ownerDocument.body.style.cursor = 'none';
    }

    this.canvas.addEventListener('mousemove', () => {
      if (mouseTimer) clearTimeout(mouseTimer);
      this.canvas.ownerDocument.body.style.cursor = 'default';
      mouseTimer = setTimeout(movedMouse.bind(this), 200);
    });

    this.window.document.body.appendChild(this.canvas);

    let resizeQueue = {};
    let lastArea = 0;
    let raf;
    let boundLoop;

    // Attach to an RAF loop for smoother resizing
    function resizeLoop() {
      raf = requestAnimationFrame(boundLoop);
      if (lastArea < 1) return;

      if ((resizeQueue.width * resizeQueue.height) + resizeQueue.dpr !== lastArea) {
        lastArea = (resizeQueue.width * resizeQueue.height) + resizeQueue.dpr;
        return;
      }

      const width = resizeQueue.width;
      const height = resizeQueue.height;
      const dpr = resizeQueue.dpr;
      const emit = resizeQueue.emit;

      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      if (emit) {
        store.dispatch('size/setDimensions', { width, height });
      }

      lastArea = 0;
    }

    boundLoop = resizeLoop.bind(this);

    this.resize = (width, height, dpr = 1, emit = true) => {
      resizeQueue = {
        width,
        height,
        dpr,
        emit,
      };
      lastArea = 1;
    };

    windowRef.addEventListener('resize', () => {
      let dpr = windowRef.devicePixelRatio;

      if (!store.getters['user/useRetina']) {
        dpr = 1;
      }

      this.resize(windowRef.innerWidth, windowRef.innerHeight, dpr);
    });
    windowRef.addEventListener('beforeunload', () => 'You sure about that, you drunken mess?');
    windowRef.addEventListener('unload', () => {
      cancelAnimationFrame(raf);
      store.dispatch('windows/destroyWindow', { windowRef: this.window });
    });

    raf = requestAnimationFrame(boundLoop);

    if (callback) callback(this);
  }
}

export default WindowController;
