(function () {
  'use strict';
  const api = window.ZarabaraMiniAuth;
  const byId = id => document.getElementById(id);
  const status = byId('status');
  const authorize = byId('authorize');
  const copy = byId('copy');
  const reveal = byId('reveal');
  const field = byId('token');
  let token = '';
  let attempt = 0;
  let expiryTimer;
  let context;
  function clear() {
    token = '';
    attempt += 1;
    clearTimeout(expiryTimer);
    field.value = '';
    field.type = 'password';
    reveal.textContent = 'Показать';
    reveal.disabled = copy.disabled = true;
    byId('result').hidden = true;
  }
  function bounded(promise) {
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), 25000);
    });
    return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
  }
  authorize.addEventListener('click', async () => {
    clear();
    const currentAttempt = attempt;
    authorize.disabled = true;
    status.textContent = 'Подтверди в окне VK доступ к историям своего профиля…';
    try {
      const response = await bounded(window.vkBridge.send('VKWebAppGetAuthToken', {
        app_id: context.appId, scope: 'stories'
      }));
      if (currentAttempt !== attempt) return;
      const granted = api.authorization(response);
      token = granted.token;
      field.value = token;
      byId('result').hidden = false;
      reveal.disabled = copy.disabled = false;
      status.textContent = 'VK вернул ключ с разрешением «Истории». Программа дополнительно проверит профиль и доступ через API. Ничего не опубликовано.';
      byId('expiry').textContent = granted.expiresSeconds ?
        'VK указал срок ключа: ' + Math.ceil(granted.expiresSeconds / 60) + ' мин. После истечения получи новый ключ.' :
        'Срок ключа VK не указал. Если программа сообщит, что он истёк, получи ключ заново.';
      expiryTimer = setTimeout(() => {
        clear();
        status.textContent = 'Ключ убран со страницы. Получи его заново, если ещё не подключил профиль в программе.';
      }, Math.min(granted.expiresSeconds || 1800, 1800) * 1000);
    } catch (error) {
      if (currentAttempt === attempt) status.textContent = api.errorMessage(error);
    } finally {
      authorize.disabled = false;
    }
  });
  copy.addEventListener('click', async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      status.textContent = 'Ключ скопирован. Вставь его в поле «Ключ личного профиля» в программе ZARABARA ИСТОРИЯ.';
    } catch (_) {
      status.textContent = 'Браузер не разрешил копирование. Нажми «Показать» и скопируй ключ вручную. В чат ключ отправлять не нужно.';
    }
  });
  reveal.addEventListener('click', () => {
    field.type = field.type === 'password' ? 'text' : 'password';
    reveal.textContent = field.type === 'password' ? 'Показать' : 'Скрыть';
  });
  byId('clear').addEventListener('click', () => {
    clear();
    status.textContent = 'Ключ убран со страницы. Уже выданный доступ можно отозвать в настройках VK.';
  });
  window.addEventListener('pagehide', clear);
  (async () => {
    try {
      const embedded = Boolean(window.vkBridge && window.vkBridge.isEmbedded());
      context = api.launchContext(window.location.search, embedded);
      if (!window.vkBridge) throw new Error('bridge unavailable');
      await bounded(window.vkBridge.send('VKWebAppInit'));
      status.textContent = 'Открыто своё мини-приложение №' + context.appId + '. VK-профиль №' + context.userId + '. Можно запросить доступ только к историям.';
      authorize.disabled = false;
    } catch (error) {
      status.textContent = api.errorMessage(error);
      authorize.disabled = true;
    }
  })();
})();
