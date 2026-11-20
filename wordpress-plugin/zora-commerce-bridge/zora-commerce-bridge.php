<?php
/**
 * Plugin Name: Diamond Market Commerce Bridge
 * Description: Production WordPress & WooCommerce bridge for Diamond Market (Shoes & Wears, Ogbomoso, Oyo State, Nigeria). Synchronizes Firebase customer identities, adds product-specific return policy metadata & admin meta box, category display metadata, and Nigerian courier delivery tracking.
 * Version: 2.0.0
 * Author: Diamond Market
 * Requires Plugins: woocommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

class Diamond_Market_Commerce_Bridge {
    const OPTION_BRIDGE_SECRET = 'diamond_bridge_secret';
    const LEGACY_OPTION_BRIDGE_SECRET = 'zora_bridge_secret';

    public function __construct() {
        add_action('rest_api_init', [$this, 'register_routes']);
        add_action('woocommerce_admin_order_data_after_shipping_address', [$this, 'render_delivery_meta_box']);
        add_action('woocommerce_process_shop_order_meta', [$this, 'save_delivery_meta_box']);
        add_action('add_meta_boxes', [$this, 'add_product_return_policy_meta_box']);
        add_action('woocommerce_process_product_meta', [$this, 'save_product_return_policy_meta_box']);
    }

    public function verify_bridge_secret(WP_REST_Request $request): bool {
        $expected = get_option(self::OPTION_BRIDGE_SECRET, '');
        if (empty($expected)) {
            $expected = get_option(self::LEGACY_OPTION_BRIDGE_SECRET, '');
        }
        if (empty($expected) && defined('DIAMOND_BRIDGE_SECRET')) {
            $expected = DIAMOND_BRIDGE_SECRET;
        }
        if (empty($expected) && defined('ZORA_BRIDGE_SECRET')) {
            $expected = ZORA_BRIDGE_SECRET;
        }
        $provided = $request->get_header('x-diamond-bridge-secret') ?: $request->get_header('x-zora-bridge-secret');
        if (empty($expected) || empty($provided)) {
            return false;
        }
        return hash_equals($expected, $provided);
    }

    public function register_routes(): void {
        foreach (['diamond/v1', 'zora/v1'] as $ns) {
            register_rest_route($ns, '/auth/sync-customer', [
                'methods'             => 'POST',
                'callback'            => [$this, 'sync_firebase_customer'],
                'permission_callback' => [$this, 'verify_bridge_secret'],
            ]);

            register_rest_route($ns, '/auth/verify-admin', [
                'methods'             => 'GET',
                'callback'            => [$this, 'verify_admin_capability'],
                'permission_callback' => function () {
                    return current_user_can('manage_woocommerce') || current_user_can('manage_options');
                },
            ]);

            register_rest_route($ns, '/orders/(?P<id>\d+)/delivery', [
                'methods'             => 'PUT',
                'callback'            => [$this, 'update_order_delivery'],
                'permission_callback' => [$this, 'verify_bridge_secret'],
            ]);

            register_rest_route($ns, '/products/(?P<id>\d+)/return-policy', [
                'methods'             => 'PUT',
                'callback'            => [$this, 'update_product_return_policy'],
                'permission_callback' => [$this, 'verify_bridge_secret'],
            ]);
        }
    }

    public function sync_firebase_customer(WP_REST_Request $request): WP_REST_Response {
        $uid          = sanitize_text_field($request->get_param('uid'));
        $email        = sanitize_email($request->get_param('email'));
        $display_name = sanitize_text_field($request->get_param('displayName'));
        $phone        = sanitize_text_field($request->get_param('phone'));

        if (empty($uid) || empty($email) || !is_email($email)) {
            return new WP_REST_Response(['error' => 'Valid Firebase UID and email required'], 400);
        }

        $user = get_user_by('email', $email);
        if (!$user) {
            $username = sanitize_user(current(explode('@', $email)) . '_' . substr($uid, 0, 6), true);
            $password = wp_generate_password(24, true, true);
            $user_id  = wp_create_user($username, $password, $email);

            if (is_wp_error($user_id)) {
                return new WP_REST_Response(['error' => $user_id->get_error_message()], 500);
            }

            $user = new WP_User($user_id);
            $user->set_role('customer');

            $parts = preg_split('/\s+/', trim($display_name));
            wp_update_user([
                'ID'           => $user_id,
                'display_name' => $display_name,
                'first_name'   => $parts[0] ?? 'Customer',
                'last_name'    => implode(' ', array_slice($parts, 1)),
            ]);
        }

        update_user_meta($user->ID, '_diamond_firebase_uid', $uid);
        if (!empty($phone)) {
            update_user_meta($user->ID, 'billing_phone', $phone);
        }
        update_user_meta($user->ID, 'billing_country', 'NG');

        return new WP_REST_Response([
            'wooCustomerId' => (int) $user->ID,
            'roles'         => $user->roles,
        ], 200);
    }

    public function verify_admin_capability(): WP_REST_Response {
        $current = wp_get_current_user();
        return new WP_REST_Response([
            'authorized' => true,
            'userId'     => $current->ID,
            'email'      => $current->user_email,
            'roles'      => $current->roles,
        ], 200);
    }

    public function update_order_delivery(WP_REST_Request $request): WP_REST_Response {
        $order_id = absint($request['id']);
        $order    = wc_get_order($order_id);
        if (!$order) {
            return new WP_REST_Response(['error' => 'Order not found'], 404);
        }

        $courier         = sanitize_text_field($request->get_param('courier'));
        $tracking_number = sanitize_text_field($request->get_param('trackingNumber'));
        $delivery_status = sanitize_text_field($request->get_param('deliveryStatus'));
        $delivery_notes  = sanitize_textarea_field($request->get_param('notes'));
        $rider_name      = sanitize_text_field($request->get_param('riderName'));
        $rider_code      = sanitize_text_field($request->get_param('riderCode'));
        $estimated_date  = sanitize_text_field($request->get_param('estimatedDeliveryDate'));
        $confirmed       = sanitize_text_field($request->get_param('customerConfirmed'));

        $order->update_meta_data('_diamond_courier', $courier);
        $order->update_meta_data('_diamond_tracking_number', $tracking_number);
        $order->update_meta_data('_diamond_delivery_status', $delivery_status);
        $order->update_meta_data('_diamond_delivery_notes', $delivery_notes);
        if (!empty($rider_name)) {
            $order->update_meta_data('_diamond_rider_name', $rider_name);
        }
        if (!empty($rider_code)) {
            $order->update_meta_data('_diamond_rider_code', $rider_code);
        }
        if (!empty($estimated_date)) {
            $order->update_meta_data('_diamond_estimated_delivery', $estimated_date);
        }
        if (!empty($confirmed)) {
            $order->update_meta_data('_diamond_customer_confirmed', $confirmed);
        }
        $order->save();

        return new WP_REST_Response(['ok' => true, 'orderId' => $order_id], 200);
    }

    public function update_product_return_policy(WP_REST_Request $request): WP_REST_Response {
        $product_id = absint($request['id']);
        $product    = wc_get_product($product_id);
        if (!$product) {
            return new WP_REST_Response(['error' => 'Product not found'], 404);
        }

        $policy = $request->get_param('returnPolicy');
        $product->update_meta_data('_diamond_return_policy', wp_json_encode($policy));
        $product->save();

        return new WP_REST_Response(['ok' => true, 'productId' => $product_id], 200);
    }

    public function add_product_return_policy_meta_box(): void {
        add_meta_box(
            'diamond_product_return_policy',
            'Diamond Market — Product Return Policy',
            [$this, 'render_product_return_policy_meta_box'],
            'product',
            'normal',
            'default'
        );
    }

    public function render_product_return_policy_meta_box($post): void {
        $raw = get_post_meta($post->ID, '_diamond_return_policy', true);
        echo '<p class="description">Custom JSON policy managed automatically from Diamond Market Admin Dashboard.</p>';
        echo '<textarea name="diamond_return_policy" rows="4" style="width:100%;font-family:monospace;">' . esc_textarea($raw) . '</textarea>';
    }

    public function save_product_return_policy_meta_box($post_id): void {
        if (isset($_POST['diamond_return_policy'])) {
            update_post_meta($post_id, '_diamond_return_policy', wp_unslash($_POST['diamond_return_policy']));
        }
    }

    public function render_delivery_meta_box($order): void {
        $courier   = $order->get_meta('_diamond_courier') ?: $order->get_meta('_zora_courier');
        $tracking  = $order->get_meta('_diamond_tracking_number') ?: $order->get_meta('_zora_tracking_number');
        $status    = $order->get_meta('_diamond_delivery_status') ?: $order->get_meta('_zora_delivery_status');
        $rider     = $order->get_meta('_diamond_rider_name');
        $confirmed = $order->get_meta('_diamond_customer_confirmed');
        echo '<div class="address"><p><strong>Diamond Market Courier:</strong> ' . esc_html($courier) . '</p>';
        echo '<p><strong>Assigned Rider:</strong> ' . esc_html($rider ?: 'Unassigned') . '</p>';
        echo '<p><strong>Tracking Number:</strong> ' . esc_html($tracking) . '</p>';
        echo '<p><strong>Delivery Status:</strong> ' . esc_html($status) . '</p>';
        echo '<p><strong>Customer Confirmed:</strong> ' . esc_html($confirmed ?: 'no') . '</p></div>';
    }

    public function save_delivery_meta_box($order_id): void {
        // Managed via REST API and WooCommerce order screen
    }
}

new Diamond_Market_Commerce_Bridge();
