/* Authorization validation only. No storage, networking or token logging. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZarabaraMiniAuth = factory();
})(globalThis, function () {
  'use strict';
  class AuthError extends Error {}
  function launchContext(search, embedded) {
    const params = new URLSearchParams(search);
    const appId = params.get('vk_app_id') || '';
    const userId = params.get('vk_user_id') || '';
    if (!embedded || !/^[1-9]\d{0,14}$/.test(appId) || !/^[1-9]\d{0,14}$/.test(userId)) {
      throw new AuthError('Открой эту страницу внутри своего мини-приложения VK. Её адрес нужно указать для веб-платформы в настройках мини-приложения. Обычной вкладки браузера недостаточно.');
    }
    return { appId: Number(appId), userId };
  }
  function authorization(result) {
    if (!result || typeof result !== 'object' || typeof result.access_token !== 'string' ||
        result.access_token.length < 20 || result.access_token.length > 8192 ||
        /[^A-Za-z0-9._~+/=-]/.test(result.access_token)) {
      throw new AuthError('VK не вернул корректный ключ профиля. Подключение не завершено.');
    }
    const scopes = typeof result.scope === 'string' ? result.scope.split(/[,\s]+/).filter(Boolean) : [];
    if (!scopes.includes('stories')) {
      throw new AuthError('VK не выдал разрешение «Истории». Ключ не показан. Подключение не завершено.');
    }
    const seconds = Number(result.expires);
    return { token: result.access_token, expiresSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null };
  }
  function bridgeContext(params) {
    params = params && typeof params === 'object' ? params : {};
    return launchContext('?'+new URLSearchParams({
      vk_app_id: String(params.vk_app_id || ''), vk_user_id: String(params.vk_user_id || '')
    }), true);
  }
  function copyPacket(granted) {
    return JSON.stringify({zarabara_vk:1,token:granted.token,
      expires_at:granted.expiresSeconds ? Math.floor(Date.now()/1000)+granted.expiresSeconds : null});
  }
  function timeoutError(stage) {
    return new AuthError({
      init: 'VK не подтвердил запуск мини-приложения. Нажми «Повторить запуск». Если загрузка снова зависнет, закрой вкладку приложения и открой её заново.',
      params: 'VK не передал параметры профиля. Повтори запуск внутри своего мини-приложения VK.',
      auth: 'VK не завершил запрос доступа. Закрой старое окно разрешения и нажми «Разрешить доступ к историям» ещё раз.',
      copy: 'VK не подтвердил копирование. Скопируй ключ вручную в программу; в чат его отправлять не нужно.'
    }[stage] || 'VK не ответил. Повтори запуск.');
  }
  function errorMessage(error) {
    if (error instanceof AuthError) return error.message;
    const code = error && error.error_data && error.error_data.error_code;
    return 'VK не выдал ключ. Подключение не завершено.' +
      (Number.isSafeInteger(code) ? ' Код ' + code + '.' : '');
  }
  return { launchContext, bridgeContext, authorization, copyPacket, timeoutError, errorMessage };
});
