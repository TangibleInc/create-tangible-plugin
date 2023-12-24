<?php

tangible\plugin\register_settings([
  'css' => $plugin->assets_url . '/build/admin.min.css',
  'title_callback' => function() use ($plugin) {
    ?>
      <img class="plugin-logo"
        src="<?= $plugin->assets_url ?>/images/tangible-logo.png"
        alt="Test Logo"
        width="40"
      >
      <?= $plugin->title ?>
    <?php
  },
]);
